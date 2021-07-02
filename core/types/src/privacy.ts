export type Circuit = {
  id: string;
  name: string;
  description?: string;
  type?: string;
  provider: string;
  provingScheme?: string;
  curve?: string;
  metadata?: object;
  provingKeyId?: string;
  verifyingKeyId?: string;
  verifierContract?: object;
}

export type Commitment = {
  metadata: object; // arbitrary data
  location: number;
  salt: string; // salt such that currentHash = H(data + salt)
  proof: number[];
  publicInputs: string[];
  sender: string; // address of participant who created the commitment
  signatures: object; // allows mapping from participant address -> signature
  timestamp: number; // unix timestamp when the commitment was pushed
  value: string; // commitment value
}
