import type { RpcErrorLike } from "./types";

export function rpcErrorMessageText(err: RpcErrorLike, fallback = "") {
  return typeof err?.message === "string" && err.message.trim()
    ? err.message
    : fallback;
}

export function rpcErrorCodeText(err: RpcErrorLike) {
  return typeof err?.code === "string" && err.code.trim() ? err.code : null;
}

export function answerSubmissionErrorText(err: RpcErrorLike) {
  return rpcErrorMessageText(
    err,
    "Answer submission failed without a detailed error message",
  );
}
