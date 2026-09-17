import { Injectable } from '@nestjs/common';

export type TalynOutboundStatus = {
  configured: boolean;
  mode: string;
};

export abstract class TalynApplicationClient {
  abstract outboundStatus(): TalynOutboundStatus;
}

@Injectable()
export class UnconfiguredTalynApplicationClient extends TalynApplicationClient {
  outboundStatus(): TalynOutboundStatus {
    return { configured: false, mode: 'unconfigured' };
  }
}
