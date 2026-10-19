export class UserResponseDto {
  id: number;
  name: string;
  email: string;
  /** Primary role (highest priority). */
  role: string;
  /** All roles held by this member. */
  roles: string[];
  isActive: boolean;
  avatarUrl: string | null;
  created_at: Date;
}

export class MemberDetailDto extends UserResponseDto {
  assignedProfileCount: number;
  signInPassword: string | null;
}

export class MemberListItemDto extends UserResponseDto {
  signInPassword: string | null;
}
