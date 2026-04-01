export class ExecutionDoneEvent {
  constructor(
    public readonly jobId: string,
    public readonly executionId: string,
    public readonly userId: string,
  ) {}
}

export class ExecutionFailedEvent {
  constructor(
    public readonly jobId: string,
    public readonly executionId: string,
    public readonly userId: string,
    public readonly reason: string,
  ) {}
}

export class ExecutionDiffEvent {
  constructor(
    public readonly jobId: string,
    public readonly executionId: string,
    public readonly userId: string,
  ) {}
}