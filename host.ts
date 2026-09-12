import { experimental_defineHostEntry } from "@get-bb/plugin-sdk/host";
import { moveHostContract } from "./move-contract";
import { inspectMove, moveDirectory } from "./move-files";
export default experimental_defineHostEntry({
  contract: moveHostContract,
  handlers: { inspect: inspectMove, move: moveDirectory },
});
