import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ type: String, nullable: true })
    email: string | null;

    @ApiProperty({ type: String, nullable: true })
    phone: string | null;

    @ApiProperty({ type: String, nullable: true })
    avatarUrl: string | null;
}
