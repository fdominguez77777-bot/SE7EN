export class UserResponseDto {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  created_at: Date;
}

export class MemberDetailDto extends UserResponseDto {
  assignedProfileCount: number;
}
