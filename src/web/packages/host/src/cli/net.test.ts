import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it, vi } from "vitest";
import {
  type LanSource,
  lanAddress,
  rankLanAddresses,
  VIRTUAL_ADAPTER_PATTERNS,
} from "./net.js";

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "00:00:00:00:00:00",
    internal,
    cidr: `${address}/24`,
  };
}

/** A machine with Hyper-V and an Npcap pseudo-adapter: the adapters this
 *  workstation enumerates ahead of its physical NIC, and what `vg-171` is
 *  about. Written out rather than read, so the case passes on a box that has
 *  neither. */
function hyperVFirst(): LanSource["interfaces"] {
  return {
    "Npcap Loopback Adapter": [ipv4("169.254.240.162")],
    "vEthernet (Default Switch)": [ipv4("172.23.96.1")],
    "Loopback Pseudo-Interface 1": [ipv4("127.0.0.1", true)],
    Ethernet: [ipv4("192.168.2.56")],
  };
}

describe("rankLanAddresses", () => {
  it("passes over a virtual switch and a link-local pseudo-adapter ahead of the physical NIC", () => {
    const choice = rankLanAddresses({
      interfaces: hyperVFirst(),
      defaultRouteInterface: undefined,
    });

    // The first non-internal IPv4 in this fixture is Npcap's `169.254.240.162`,
    // which is what the old "first non-internal" rule returned.
    expect(choice.address).toBe("192.168.2.56");
    expect(choice.alternatives).toEqual([]);
  });

  it("names the alternatives when it picks without a default route to go by", () => {
    const choice = rankLanAddresses({
      interfaces: {
        "vEthernet (WSL)": [ipv4("172.20.0.1")],
        Ethernet: [ipv4("192.168.2.56")],
        "Ethernet 2": [ipv4("10.0.0.7")],
      },
      defaultRouteInterface: undefined,
    });

    expect(choice.address).toBe("192.168.2.56");
    expect(choice.alternatives).toEqual(["Ethernet 2 10.0.0.7"]);
  });

  it("prefers the default route even when it is not the first candidate", () => {
    const choice = rankLanAddresses({
      interfaces: {
        Ethernet: [ipv4("10.0.0.7")],
        "Ethernet 2": [ipv4("192.168.1.5")],
      },
      defaultRouteInterface: "Ethernet 2",
    });

    expect(choice.address).toBe("192.168.1.5");
    // The route decided it, so nothing was a guess and nothing is reported.
    expect(choice.alternatives).toEqual([]);
  });

  it("answers one physical adapter exactly as before, route or no route", () => {
    const one = { interfaces: { Ethernet: [ipv4("192.168.2.56")] } };

    expect(
      rankLanAddresses({ ...one, defaultRouteInterface: "Ethernet" }),
    ).toEqual({ address: "192.168.2.56", alternatives: [] });
    expect(
      rankLanAddresses({ ...one, defaultRouteInterface: undefined }),
    ).toEqual({ address: "192.168.2.56", alternatives: [] });
  });

  it("has nothing to offer when only virtual adapters are up", () => {
    const choice = rankLanAddresses({
      interfaces: {
        "vEthernet (Default Switch)": [ipv4("172.23.96.1")],
        "Npcap Loopback Adapter": [ipv4("169.254.240.162")],
      },
      defaultRouteInterface: undefined,
    });

    expect(choice).toEqual({ address: undefined, alternatives: [] });
  });
});

describe("lanAddress", () => {
  it("says on the console which other addresses were in the running", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const address = await lanAddress({
        interfaces: {
          "vEthernet (WSL)": [ipv4("172.20.0.1")],
          Ethernet: [ipv4("192.168.2.56")],
          "Ethernet 2": [ipv4("10.0.0.7")],
        },
        defaultRouteInterface: undefined,
      });

      expect(address).toBe("192.168.2.56");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain("Ethernet 2 10.0.0.7");
    } finally {
      warn.mockRestore();
    }
  });

  it("stays quiet when the default route decided the pick", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const address = await lanAddress({
        interfaces: { Ethernet: [ipv4("192.168.2.56")] },
        defaultRouteInterface: "Ethernet",
      });

      expect(address).toBe("192.168.2.56");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("VIRTUAL_ADAPTER_PATTERNS", () => {
  it("names every adapter family the ruling lists", () => {
    const dropped = [
      "vEthernet (Default Switch)",
      "vEthernet (WSL)",
      "Hyper-V Virtual Ethernet Adapter",
      "docker0",
      "br-1a2b3c4d5e6f",
      "VirtualBox Host-Only Network",
      "VMware Network Adapter VMnet1",
      "WireGuard Tunnel",
      "tun0",
      "Npcap Loopback Adapter",
    ];

    for (const name of dropped) {
      expect(
        VIRTUAL_ADAPTER_PATTERNS.some((pattern) => pattern.test(name)),
        name,
      ).toBe(true);
    }
  });

  it("leaves the physical adapters this machine enumerates alone", () => {
    for (const name of ["Ethernet", "Ethernet 2", "Wi-Fi", "en0", "eth0"]) {
      expect(
        VIRTUAL_ADAPTER_PATTERNS.some((pattern) => pattern.test(name)),
        name,
      ).toBe(false);
    }
  });
});
