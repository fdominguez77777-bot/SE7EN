import { PartialType } from '@nestjs/swagger';

import { CreateWorkExperienceDto } from './create-work-experience.dto';

export class UpdateWorkExperienceDto extends PartialType(
  CreateWorkExperienceDto,
) {}
