import { localNetworkAddresses, type SyncServerInfo } from "./server";

export interface SyncPairingInfo {
  enabled: boolean;
  port: number;
  addresses: string[];
  token: string;
  error: string | null;
}

type AddressProvider = () => string[];

let pairingInfo: Omit<SyncPairingInfo, "addresses"> = { enabled: false, port: 0, token: "", error: null };
let addressProvider: AddressProvider = localNetworkAddresses;

export function setSyncServerInfo(info: SyncServerInfo, token: string, provider: AddressProvider = localNetworkAddresses): void {
  pairingInfo = { enabled: true, port: info.port, token, error: null };
  addressProvider = provider;
}

export function setSyncServerUnavailable(error: string): void {
  pairingInfo = { enabled: false, port: 0, token: "", error };
  addressProvider = localNetworkAddresses;
}

export function setSyncServerDisabled(): void {
  pairingInfo = { enabled: false, port: 0, token: "", error: null };
  addressProvider = localNetworkAddresses;
}

/** Pairing details rendered in the desktop UI so the phone can be pointed at this Mac. */
export function readSyncPairingInfo(): SyncPairingInfo {
  let addresses: string[] = [];
  if (pairingInfo.enabled) {
    try {
      addresses = addressProvider();
    } catch {
      addresses = [];
    }
  }
  return { ...pairingInfo, addresses };
}
