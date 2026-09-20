export const ERROR_CODES = [
  "signInRequired",
  "invalidCredentials",
  "emailTaken",
  "aliasTaken",
  "invalidAlias",
  "invalidInput",
  "unexpected",
  "contractNotFound",
  "notAParty",
  "guaranteeNotFound",
  "aliasNotFound",
  "cannotGuaranteeYourself",
  "onlyGuarantorRegisters",
  "notAwaitingDeposit",
  "guaranteeAlreadyRegistered",
  "onlyGuarantorFunds",
  "onlyGuarantorCancels",
  "notPending",
  "notAwaitingAcceptance",
  "onlyLandlordAccepts",
  "onlyLandlordRejects",
  "reasonRequired",
  "notActive",
  "noOpenSettlement",
  "noSettlementToAccept",
  "noSettlementToReject",
  "noAgreementYet",
  "cannotAcceptOwnProposal",
  "cannotRejectOwnProposal",
  "exceedsLocked",
  "onlyLandlordReturns",
  "onlyGuarantorExtends",
  "onlyLandlordAcceptsExtension",
  "noExtensionPending",
  "extensionAlreadyPending",
  "invalidTransition",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code: ErrorCode = "unexpected",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, code: ErrorCode) =>
  new AppError(message, 400, code);
export const forbidden = (message: string, code: ErrorCode) =>
  new AppError(message, 403, code);
export const notFound = (message: string, code: ErrorCode) =>
  new AppError(message, 404, code);
export const conflict = (message: string, code: ErrorCode) =>
  new AppError(message, 409, code);
