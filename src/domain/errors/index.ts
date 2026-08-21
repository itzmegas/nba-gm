export class DomainError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SalaryMatchingError extends DomainError {
  constructor(message: string) {
    super("SALARY_MATCHING_VIOLATION", message);
  }
}

export class HardCapError extends DomainError {
  constructor(message: string) {
    super("HARD_CAP_VIOLATION", message);
  }
}

export class RosterSizeError extends DomainError {
  constructor(message: string) {
    super("ROSTER_SIZE_VIOLATION", message);
  }
}
