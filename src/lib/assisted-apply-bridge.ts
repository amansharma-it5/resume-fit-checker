import { ASSISTED_APPLY_PROTOCOL, type ApplicationBridgeSnapshot } from "./assisted-apply";

export type ApplicationBridgeMessage =
  | { protocol: typeof ASSISTED_APPLY_PROTOCOL; type: "BRIDGE_READY"; nonce: string }
  | { protocol: typeof ASSISTED_APPLY_PROTOCOL; type: "BRIDGE_PROFILE_REQUEST"; nonce: string }
  | {
      protocol: typeof ASSISTED_APPLY_PROTOCOL;
      type: "BRIDGE_PROFILE_RESPONSE";
      nonce: string;
      snapshot: ApplicationBridgeSnapshot;
    };

export function createBridgeNonce() {
  return crypto.randomUUID();
}

export function isBridgeMessage(value: unknown): value is ApplicationBridgeMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ApplicationBridgeMessage>;
  return message.protocol === ASSISTED_APPLY_PROTOCOL && typeof message.type === "string";
}
