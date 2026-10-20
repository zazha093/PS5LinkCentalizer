# PS5 build (needs the ps5-payload-sdk: https://github.com/ps5-payload-dev/sdk)
#   export PS5_PAYLOAD_SDK=/opt/ps5-payload-sdk && make
# Linux build for testing on a PC: make -f Makefile.linux
PS5_HOST ?= ps5
PS5_PORT ?= 9021

ifdef PS5_PAYLOAD_SDK
    include $(PS5_PAYLOAD_SDK)/toolchain/prospero.mk
else
    $(error PS5_PAYLOAD_SDK is undefined)
endif

VERSION ?= 0.2.0
ELF := ps5links-agent.elf
CFLAGS := -Wall -Werror -O2 -DAGENT_VERSION=\"$(VERSION)\"

all: $(ELF)

$(ELF): agent.c
	$(CC) $(CFLAGS) -o $@ $^ -lpthread

clean:
	rm -f $(ELF)

# Send it to the PS5's ELF loader: make test PS5_HOST=192.168.1.50
test: $(ELF)
	$(PS5_DEPLOY) -h $(PS5_HOST) -p $(PS5_PORT) $^
