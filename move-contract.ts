import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";
export const moveInput = z
  .object({ source: z.string().min(1), destination: z.string().min(1) })
  .strict();
export const moveHostContract = defineRpcContract({
  inspect: {
    input: moveInput,
    output: z.object({
      source: z.string(),
      destination: z.string(),
      moved: z.boolean(),
    }),
  },
  move: {
    input: moveInput,
    output: z.object({
      source: z.string(),
      destination: z.string(),
      moved: z.boolean(),
    }),
  },
});
