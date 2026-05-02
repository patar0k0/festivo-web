export function assertRpcUserUuid(userId: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error("Invalid UUID");
  }
}
