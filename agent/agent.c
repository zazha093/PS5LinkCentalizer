/* PS5Links Agent: a small HTTP file service for the PS5 Links website.
 *
 * Lets the site (on a phone/PC in the same Wi-Fi) upload files into a folder
 * such as /data/homebrew, create folders, list folders and run an ELF through
 * the console's ELF loader (127.0.0.1:9021).
 *
 *   GET  /api/info                         no PIN needed; {"auth":true} if the PIN header is right
 *   GET  /api/ls?path=/data/homebrew       list a folder
 *   POST /api/mkdir?path=/data/homebrew/x  create a folder (and its parents)
 *   PUT  /api/upload?path=...&offset=N     write the request body into a file at byte N
 *                                          (offset=0 creates/truncates; chunked uploads + resume)
 *   POST /api/run?path=/data/.../x.elf     send that ELF to the ELF loader on port 9021
 *
 * Every /api call except /api/info needs the header  X-Agent-Pin: <6 digits>.
 * The PIN is random, saved in /data/ps5links-agent/pin.txt and shown as a PS5
 * notification when the agent starts. Only paths under /data/ and /mnt/usb*,
 * /mnt/ext* are accepted, and ".." is rejected.
 *
 * Builds for the PS5 with the ps5-payload-sdk (Makefile) and for Linux
 * (Makefile.linux) so the same code can be tested on a PC. On Linux, set
 * AGENT_ROOT=/some/dir to map /data/... to /some/dir/data/...
 *
 * License: GPL-3.0-or-later (same family as the PS5 payload SDK samples).
 */
#include <arpa/inet.h>
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <ifaddrs.h>
#include <netinet/in.h>
#include <pthread.h>
#include <signal.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/mount.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>
#ifdef __linux__
#include <sys/statfs.h>
#endif

#ifndef AGENT_VERSION
#define AGENT_VERSION "0.1.0"
#endif
#define DEFAULT_PORT 8686
#define ELFLDR_PORT  9021
#define HDR_MAX      16384
#define PATH_MAX_LEN 1024
#define IO_BUF       (256 * 1024)

static char g_pin[8];          /* 6-digit pairing PIN */
static const char *g_root = ""; /* "" on the PS5; AGENT_ROOT on Linux */

/* ---------------------------------------------------------------- notify */
#ifdef __SCE__
typedef struct notify_request { char useless1[45]; char message[3075]; } notify_request_t;
int sceKernelSendNotificationRequest(int, notify_request_t *, size_t, int);
#endif

static void notify(const char *fmt, ...) {
  char msg[512];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(msg, sizeof msg, fmt, ap);
  va_end(ap);
#ifdef __SCE__
  notify_request_t req;
  memset(&req, 0, sizeof req);
  snprintf(req.message, sizeof req.message, "%s", msg);
  sceKernelSendNotificationRequest(0, &req, sizeof req, 0);
#endif
  printf("[agent] %s\n", msg);
  fflush(stdout);
}

/* ---------------------------------------------------------------- helpers */
static int hexval(int c) {
  if (c >= '0' && c <= '9') return c - '0';
  c |= 0x20;
  return (c >= 'a' && c <= 'f') ? c - 'a' + 10 : -1;
}

/* Decode %XX and '+' in place */
static void url_decode(char *s) {
  char *o = s;
  for (; *s; s++) {
    if (*s == '%' && hexval(s[1]) >= 0 && hexval(s[2]) >= 0) {
      *o++ = (char)(hexval(s[1]) * 16 + hexval(s[2]));
      s += 2;
    } else if (*s == '+') *o++ = ' ';
    else *o++ = *s;
  }
  *o = 0;
}

/* Copy query parameter `name` from "a=1&b=2" into out (decoded). Returns 1 if found. */
static int query_get(const char *q, const char *name, char *out, size_t outsz) {
  size_t n = strlen(name);
  while (q && *q) {
    const char *amp = strchr(q, '&');
    size_t len = amp ? (size_t)(amp - q) : strlen(q);
    if (len > n && !strncmp(q, name, n) && q[n] == '=') {
      size_t vlen = len - n - 1;
      if (vlen >= outsz) return 0;
      memcpy(out, q + n + 1, vlen);
      out[vlen] = 0;
      url_decode(out);
      return 1;
    }
    q = amp ? amp + 1 : NULL;
  }
  return 0;
}

/* Only allow /data/..., /mnt/usbN/..., /mnt/extN/...; reject "." / ".." segments,
 * control characters and backslashes. */
static int path_ok(const char *p) {
  size_t len = strlen(p);
  if (len < 5 || len >= PATH_MAX_LEN) return 0;
  if (strncmp(p, "/data", 5) && strncmp(p, "/mnt/usb", 8) && strncmp(p, "/mnt/ext", 8)) return 0;
  if (!strncmp(p, "/data", 5) && p[5] != 0 && p[5] != '/') return 0;
  for (const char *c = p; *c; c++)
    if ((unsigned char)*c < 0x20 || *c == '\\') return 0;
  for (const char *seg = p; seg && *seg;) {
    seg++; /* skip '/' */
    const char *end = strchr(seg, '/');
    size_t l = end ? (size_t)(end - seg) : strlen(seg);
    if ((l == 1 && seg[0] == '.') || (l == 2 && seg[0] == '.' && seg[1] == '.')) return 0;
    if (l == 0 && end) return 0; /* "//" */
    seg = end;
  }
  return 1;
}

/* Real filesystem path (adds AGENT_ROOT on Linux) */
static void real_path(const char *p, char *out, size_t sz) { snprintf(out, sz, "%s%s", g_root, p); }

static int mkdir_p(const char *real) {
  char tmp[PATH_MAX_LEN + 256];
  snprintf(tmp, sizeof tmp, "%s", real);
  for (char *c = tmp + 1; *c; c++) {
    if (*c != '/') continue;
    *c = 0;
    if (mkdir(tmp, 0777) && errno != EEXIST) return -1;
    *c = '/';
  }
  return (mkdir(tmp, 0777) && errno != EEXIST) ? -1 : 0;
}

/* Append a JSON string with escaping */
static void json_str(char **buf, size_t *len, size_t *cap, const char *s) {
  for (;;) {
    size_t need = *len + strlen(s) * 6 + 8;
    if (need < *cap) break;
    *cap = need * 2;
    *buf = realloc(*buf, *cap);
  }
  char *o = *buf + *len;
  *o++ = '"';
  for (const unsigned char *c = (const unsigned char *)s; *c; c++) {
    if (*c == '"' || *c == '\\') { *o++ = '\\'; *o++ = (char)*c; }
    else if (*c < 0x20) o += sprintf(o, "\\u%04x", *c);
    else *o++ = (char)*c;
  }
  *o++ = '"';
  *o = 0;
  *len = (size_t)(o - *buf);
}

static void buf_add(char **buf, size_t *len, size_t *cap, const char *fmt, ...) {
  va_list ap;
  for (;;) {
    va_start(ap, fmt);
    int n = vsnprintf(*buf + *len, *cap - *len, fmt, ap);
    va_end(ap);
    if (n >= 0 && (size_t)n < *cap - *len) { *len += (size_t)n; return; }
    *cap = (*cap + (size_t)(n > 0 ? n : 256)) * 2;
    *buf = realloc(*buf, *cap);
  }
}

/* ---------------------------------------------------------------- HTTP */
static int send_all(int fd, const void *data, size_t len) {
  const char *p = data;
  while (len) {
    ssize_t n = send(fd, p, len, 0);
    if (n <= 0) { if (n < 0 && errno == EINTR) continue; return -1; }
    p += n; len -= (size_t)n;
  }
  return 0;
}

/* CORS + Chrome Local Network Access headers are added to every answer */
static void reply(int fd, int status, const char *ctype, const char *body, size_t blen) {
  const char *text = status == 200 ? "OK" : status == 204 ? "No Content" : status == 400 ? "Bad Request" :
                     status == 401 ? "Unauthorized" : status == 403 ? "Forbidden" : status == 404 ? "Not Found" :
                     status == 409 ? "Conflict" : status == 413 ? "Payload Too Large" : status == 502 ? "Bad Gateway" : "Error";
  char hdr[1024];
  int n = snprintf(hdr, sizeof hdr,
    "HTTP/1.1 %d %s\r\n"
    "Content-Type: %s\r\n"
    "Content-Length: %zu\r\n"
    "Access-Control-Allow-Origin: *\r\n"
    "Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS\r\n"
    "Access-Control-Allow-Headers: Content-Type, X-Agent-Pin\r\n"
    "Access-Control-Allow-Private-Network: true\r\n"
    "Access-Control-Max-Age: 600\r\n"
    "Cache-Control: no-store\r\n"
    "Connection: close\r\n\r\n",
    status, text, ctype, blen);
  send_all(fd, hdr, (size_t)n);
  if (blen) send_all(fd, body, blen);
}

static void reply_json(int fd, int status, const char *json) { reply(fd, status, "application/json", json, strlen(json)); }

static void reply_err(int fd, int status, const char *msg) {
  char *b = malloc(64); size_t l = 0, c = 64;
  buf_add(&b, &l, &c, "{\"error\":");
  json_str(&b, &l, &c, msg);
  buf_add(&b, &l, &c, "}");
  reply_json(fd, status, b);
  free(b);
}

typedef struct {
  char method[8];
  char path[256];       /* "/api/upload" */
  char query[2048];     /* "path=...&offset=..." */
  char pin[16];         /* X-Agent-Pin header */
  long long clen;       /* Content-Length, -1 if absent */
  char *extra;          /* body bytes already read together with the headers */
  size_t extra_len;
} request_t;


/* Read and parse the request line + headers. Returns 0 on success. */
static int read_request(int fd, char *buf, request_t *r) {
  size_t got = 0;
  char *hdr_end = NULL;
  memset(r, 0, sizeof *r);
  r->clen = -1;
  while (!hdr_end) {
    if (got >= HDR_MAX - 1) return -1;
    ssize_t n = recv(fd, buf + got, HDR_MAX - 1 - got, 0);
    if (n <= 0) return -1;
    got += (size_t)n;
    buf[got] = 0;
    hdr_end = strstr(buf, "\r\n\r\n");
  }
  *hdr_end = 0;
  r->extra = hdr_end + 4;
  r->extra_len = got - (size_t)(r->extra - buf);

  /* Request line: METHOD /target HTTP/1.1 */
  char target[2400] = {0};
  if (sscanf(buf, "%7s %2399s", r->method, target) != 2) return -1;
  char *mark = strchr(target, '?');
  if (mark) { *mark = 0; snprintf(r->query, sizeof r->query, "%s", mark + 1); }
  snprintf(r->path, sizeof r->path, "%s", target);

  /* Headers we care about */
  for (char *line = strstr(buf, "\r\n"); line; line = strstr(line, "\r\n")) {
    line += 2;
    if (!strncasecmp(line, "Content-Length:", 15)) r->clen = atoll(line + 15);
    else if (!strncasecmp(line, "X-Agent-Pin:", 12)) {
      char *v = line + 12;
      while (*v == ' ') v++;
      size_t k = 0;
      while (v[k] && v[k] != '\r' && k < sizeof r->pin - 1) { r->pin[k] = v[k]; k++; }
      r->pin[k] = 0;
    }
  }
  return 0;
}

/* ---------------------------------------------------------------- handlers */
static void h_info(int fd, const request_t *r) {
  char json[512];
  unsigned long long freeb = 0;
  struct statfs sf;
  char real[PATH_MAX_LEN + 256];
  real_path("/data", real, sizeof real);
  if (!statfs(real, &sf)) freeb = (unsigned long long)sf.f_bavail * (unsigned long long)sf.f_bsize;
  snprintf(json, sizeof json,
           "{\"name\":\"PS5Links Agent\",\"version\":\"%s\",\"auth\":%s,\"free\":%llu,\"elfldr\":%d}",
           AGENT_VERSION, (r->pin[0] && !strcmp(r->pin, g_pin)) ? "true" : "false", freeb, ELFLDR_PORT);
  reply_json(fd, 200, json);
}

static void h_ls(int fd, const char *path) {
  char real[PATH_MAX_LEN + 256];
  real_path(path, real, sizeof real);
  DIR *d = opendir(real);
  if (!d) { reply_err(fd, 404, strerror(errno)); return; }
  size_t len = 0, cap = 4096;
  char *b = malloc(cap);
  b[0] = 0;
  buf_add(&b, &len, &cap, "[");
  int first = 1;
  struct dirent *e;
  while ((e = readdir(d))) {

    if (!strcmp(e->d_name, ".") || !strcmp(e->d_name, "..")) continue;
    char full[PATH_MAX_LEN * 2];
    struct stat st;
    snprintf(full, sizeof full, "%s/%s", real, e->d_name);
    if (stat(full, &st)) continue;
    buf_add(&b, &len, &cap, "%s{\"name\":", first ? "" : ",");
    json_str(&b, &len, &cap, e->d_name);
    buf_add(&b, &len, &cap, ",\"dir\":%s,\"size\":%lld,\"mtime\":%lld}",
            S_ISDIR(st.st_mode) ? "true" : "false", (long long)st.st_size, (long long)st.st_mtime);
    first = 0;
  }
  closedir(d);
  buf_add(&b, &len, &cap, "]");
  reply_json(fd, 200, b);
  free(b);
}

static void h_mkdir(int fd, const char *path) {
  char real[PATH_MAX_LEN + 256];
  real_path(path, real, sizeof real);
  if (mkdir_p(real)) { reply_err(fd, 500, strerror(errno)); return; }
  reply_json(fd, 200, "{\"ok\":true}");
}

/* Write the request body into `path` starting at `offset`.
 * offset=0 creates or truncates the file; a different offset must equal the current
 * size (so a dropped chunk is detected and the site can resume from "size"). */
static void h_upload(int fd, const request_t *r, const char *path, long long offset) {
  if (r->clen < 0) { reply_err(fd, 400, "Content-Length required"); return; }
  char real[PATH_MAX_LEN + 256], dir[PATH_MAX_LEN + 256];
  real_path(path, real, sizeof real);
  snprintf(dir, sizeof dir, "%s", real);
  char *slash = strrchr(dir, '/');
  if (slash && slash != dir) { *slash = 0; if (mkdir_p(dir)) { reply_err(fd, 500, strerror(errno)); return; } }

  int out = open(real, O_WRONLY | O_CREAT | (offset == 0 ? O_TRUNC : 0), 0666);
  if (out < 0) { reply_err(fd, 500, strerror(errno)); return; }
  struct stat st;
  fstat(out, &st);
  if (offset != 0 && st.st_size != offset) {
    char j[96];
    snprintf(j, sizeof j, "{\"error\":\"offset mismatch\",\"size\":%lld}", (long long)st.st_size);
    close(out);
    reply_json(fd, 409, j);
    return;
  }
  lseek(out, offset, SEEK_SET);

  /* Body: first the bytes that arrived with the headers, then the rest of the socket */
  long long left = r->clen;
  int failed = 0;
  size_t first = r->extra_len < (size_t)left ? r->extra_len : (size_t)left;
  if (first && write(out, r->extra, first) != (ssize_t)first) failed = 1;
  left -= (long long)first;
  char *io = malloc(IO_BUF);
  while (!failed && left > 0) {
    ssize_t n = recv(fd, io, left < IO_BUF ? (size_t)left : IO_BUF, 0);
    if (n <= 0) { if (n < 0 && errno == EINTR) continue; failed = 2; break; }
    if (write(out, io, (size_t)n) != n) failed = 1;
    left -= n;
  }
  free(io);
  fstat(out, &st);
  close(out);
  if (failed == 1) { reply_err(fd, 500, "write failed (disk full?)"); return; }
  if (failed == 2) return; /* client went away; the site resumes from the current size */
  char j[64];
  snprintf(j, sizeof j, "{\"ok\":true,\"size\":%lld}", (long long)st.st_size);
  reply_json(fd, 200, j);
}

/* Hand an ELF file to the console's ELF loader (127.0.0.1:9021), like "nc ps5 9021 < x.elf" */
static void h_run(int fd, const char *path) {
  char real[PATH_MAX_LEN + 256];
  real_path(path, real, sizeof real);
  int in = open(real, O_RDONLY);
  if (in < 0) { reply_err(fd, 404, strerror(errno)); return; }
  unsigned char magic[4] = {0};
  if (read(in, magic, 4) != 4 || memcmp(magic, "\x7f" "ELF", 4)) {
    close(in);
    reply_err(fd, 400, "not an ELF file");
    return;
  }
  lseek(in, 0, SEEK_SET);

  int ldr = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in sa;
  memset(&sa, 0, sizeof sa);
  sa.sin_family = AF_INET;
  sa.sin_port = htons(ELFLDR_PORT);
  sa.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (ldr < 0 || connect(ldr, (struct sockaddr *)&sa, sizeof sa)) {
    if (ldr >= 0) close(ldr);
    close(in);
    reply_err(fd, 502, "ELF loader (port 9021) is not running");
    return;
  }
  char *io = malloc(IO_BUF);
  ssize_t n;
  int failed = 0;
  while ((n = read(in, io, IO_BUF)) > 0)
    if (send_all(ldr, io, (size_t)n)) { failed = 1; break; }
  free(io);
  close(in);
  close(ldr);
  if (failed) { reply_err(fd, 502, "ELF loader closed the connection"); return; }
  notify("PS5Links Agent: started %s", path);
  reply_json(fd, 200, "{\"ok\":true}");
}

/* ---------------------------------------------------------------- dispatch */
static void *client_thread(void *arg) {
  int fd = (int)(intptr_t)arg;
  struct timeval tv = {60, 0};
  setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
  setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv);

  char *buf = malloc(HDR_MAX);
  request_t r;
  if (read_request(fd, buf, &r)) goto done;

  if (!strcmp(r.method, "OPTIONS")) { reply(fd, 204, "text/plain", "", 0); goto done; } /* CORS preflight */
  if (!strcmp(r.path, "/api/info")) { h_info(fd, &r); goto done; }
  if (!strcmp(r.path, "/") ) {
    const char *t = "PS5Links Agent " AGENT_VERSION " is running. Open the PS5 Links site to use it.\n";
    reply(fd, 200, "text/plain; charset=utf-8", t, strlen(t));
    goto done;
  }
  if (strncmp(r.path, "/api/", 5)) { reply_err(fd, 404, "unknown endpoint"); goto done; }
  if (!r.pin[0] || strcmp(r.pin, g_pin)) { reply_err(fd, 401, "wrong or missing PIN"); goto done; }

  char path[PATH_MAX_LEN];
  if (!query_get(r.query, "path", path, sizeof path) || !path_ok(path)) {
    reply_err(fd, 403, "path must be under /data/, /mnt/usbN/ or /mnt/extN/ without ..");
    goto done;
  }
  size_t pl = strlen(path);
  if (pl > 1 && path[pl - 1] == '/') path[pl - 1] = 0;

  if (!strcmp(r.path, "/api/ls") && !strcmp(r.method, "GET")) h_ls(fd, path);
  else if (!strcmp(r.path, "/api/mkdir") && !strcmp(r.method, "POST")) h_mkdir(fd, path);
  else if (!strcmp(r.path, "/api/upload") && !strcmp(r.method, "PUT")) {
    char off[32] = "0";
    query_get(r.query, "offset", off, sizeof off);
    long long o = atoll(off);
    if (o < 0) reply_err(fd, 400, "bad offset");
    else h_upload(fd, &r, path, o);
  }
  else if (!strcmp(r.path, "/api/run") && !strcmp(r.method, "POST")) h_run(fd, path);
  else reply_err(fd, 404, "unknown endpoint");

done:
  free(buf);
  close(fd);
  return NULL;
}

/* ---------------------------------------------------------------- PIN */
/* Load the PIN from /data/ps5links-agent/pin.txt, or create a random one */
static void load_pin(void) {
  char dir[PATH_MAX_LEN + 256], file[PATH_MAX_LEN + 300];
  real_path("/data/ps5links-agent", dir, sizeof dir);
  snprintf(file, sizeof file, "%s/pin.txt", dir);
  FILE *f = fopen(file, "r");
  if (f) {
    if (fscanf(f, "%6s", g_pin) == 1 && strlen(g_pin) == 6) { fclose(f); return; }
    fclose(f);
  }
  unsigned int seed = 0;
  int rnd = open("/dev/urandom", O_RDONLY);
  if (rnd < 0 || read(rnd, &seed, sizeof seed) != sizeof seed) seed = (unsigned)time(NULL) ^ (unsigned)getpid();
  if (rnd >= 0) close(rnd);
  snprintf(g_pin, sizeof g_pin, "%06u", seed % 1000000u);
  mkdir_p(dir);
  if ((f = fopen(file, "w"))) { fprintf(f, "%s\n", g_pin); fclose(f); }
}

/* First non-loopback IPv4 address, for the start-up notification */
static void local_ip(char *out, size_t sz) {
  struct ifaddrs *ifa_list, *ifa;
  snprintf(out, sz, "?");
  if (getifaddrs(&ifa_list)) return;
  for (ifa = ifa_list; ifa; ifa = ifa->ifa_next) {
    if (!ifa->ifa_addr || ifa->ifa_addr->sa_family != AF_INET || !strncmp(ifa->ifa_name, "lo", 2)) continue;
    inet_ntop(AF_INET, &((struct sockaddr_in *)ifa->ifa_addr)->sin_addr, out, (socklen_t)sz);
    if (strncmp(out, "0.", 2)) break;
  }
  freeifaddrs(ifa_list);
}

/* ---------------------------------------------------------------- main */
int main(int argc, char **argv) {
  int port = DEFAULT_PORT;
  if (argc > 1) port = atoi(argv[1]);
  if (port <= 0 || port > 65535) port = DEFAULT_PORT;
  if (getenv("AGENT_ROOT")) g_root = getenv("AGENT_ROOT");
  signal(SIGPIPE, SIG_IGN);
  load_pin();

  int srv = socket(AF_INET, SOCK_STREAM, 0);
  int one = 1;
  setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
  struct sockaddr_in sa;
  memset(&sa, 0, sizeof sa);
  sa.sin_family = AF_INET;
  sa.sin_port = htons((uint16_t)port);
  sa.sin_addr.s_addr = htonl(INADDR_ANY);
  if (srv < 0 || bind(srv, (struct sockaddr *)&sa, sizeof sa) || listen(srv, 16)) {
    notify("PS5Links Agent: port %d is busy (already running?)", port);
    return 1;
  }

  char ip[64];
  local_ip(ip, sizeof ip);
  notify("PS5Links Agent %s\n%s:%d  PIN %s", AGENT_VERSION, ip, port, g_pin);

  for (;;) {
    int c = accept(srv, NULL, NULL);
    if (c < 0) { if (errno == EINTR) continue; sleep(1); continue; }
    pthread_t th;
    if (pthread_create(&th, NULL, client_thread, (void *)(intptr_t)c)) { close(c); continue; }
    pthread_detach(th);
  }
  return 0;
}
