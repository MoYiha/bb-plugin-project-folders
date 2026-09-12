import { editFolder } from "./folder-files";
import { experimental_defineHostEntry } from "@get-bb/plugin-sdk/host";
import { moveHostContract } from "./move-contract";
import { inspectMove, moveDirectory } from "./move-files";
export default experimental_defineHostEntry({
  contract: moveHostContract,
  handlers: {
    folder_edit: editFolder,
    inspect: inspectMove,
    move: moveDirectory,
  },
});
