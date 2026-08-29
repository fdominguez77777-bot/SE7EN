export class UserResponseDto {
  id: number;
  name: string;
  email: string;
  role: string;
  bidderProfileId: number | null;
  created_at: Date;
}
