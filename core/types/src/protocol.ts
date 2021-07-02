export const messageReservedBitsLength = 512; // reserved bits for future use

export enum Opcode {
  Baseline = 'BLINE', // baseline message
  Join = 'JOIN', // join workgroup
  Sync = 'SYNC', // synchronize workgroup config
}

export enum PayloadType {
  Binary = 0x0,
  Text = 0x1,
}

export type Message = {
  opcode: Opcode; // up to 40 bits
  sender: string; // up to 336 bits
  recipient: string; // up to 336 bits
  shield: string; // up to 336 bits
  identifier: string; // up to 288 bits (i.e., UUIDv4 circuit/workflow identifier)
  signature: string; // 512 bits
  type: PayloadType; // 1 bit
  payload: Buffer; // arbitrary length
}

// v0.1 proof of concept! protocol buffers or similar impl forthcoming
export const marshalProtocolMessage = (msg: Message): Buffer => {
  const reservedBits = Buffer.alloc(messageReservedBitsLength / 8);
  const buffer = Buffer.alloc(5 + 42 + 42 + 42 + 36 + 64 + 1 + reservedBits.length + msg.payload.length);

  buffer.write(msg.opcode);
  buffer.write(msg.sender, 5);
  buffer.write(msg.recipient, 5 + 42);
  buffer.write(msg.shield, 5 + 42 + 42);
  buffer.write(msg.identifier, 5 + 42 + 42 + 42);
  buffer.write(reservedBits.toString(), 5 + 42 + 42 + 42 + 36);
  buffer.write(msg.signature, 5 + 42 + 42 + 42 + 36 + reservedBits.length);
  buffer.write(msg.type.toString(), 5 + 42 + 42 + 42 + 36 + reservedBits.length + 64);

  const encoding = msg.type === PayloadType.Binary ? 'binary' : 'utf8';
  buffer.write(msg.payload.toString(encoding), 5 + 42 + 42 + 42 + 36 + reservedBits.length + 64 + 1);

  return buffer;
};

// v0.1 proof of concept! protocol buffers or similar impl forthcoming
export const unmarshalProtocolMessage = (msg: Buffer): Message => {
  const reservedSize = messageReservedBitsLength / 8;
  const type = msg.subarray(5 + 42 + 42 + 42 + 36 + 64 + reservedSize, 5 + 42 + 42 + 42 + 36 + 64 + 1 + reservedSize).toString();
  return {
    opcode: msg.subarray(0, 5).toString().replace(/\0/g, ''),
    sender: msg.subarray(5, 5 + 42).toString(),
    recipient: msg.subarray(5 + 42, 5 + 42 + 42).toString(),
    shield: msg.subarray(5 + 42 + 42, 5 + 42 + 42 + 42).toString(),
    identifier: msg.subarray(5 + 42 + 42 + 42, 5 + 42 + 42 + 42 + 36).toString(),
    signature: msg.subarray(5 + 42 + 42 + 42 + 36 + reservedSize, 5 + 42 + 42 + 42 + 36 + 64 + reservedSize).toString(),
    type: type === '0' ? PayloadType.Binary : (type === '1' ? PayloadType.Text : null),
    payload: msg.subarray(5 + 42 + 42 + 42 + 36 + 64 + reservedSize + 1),
  } as Message;
};
