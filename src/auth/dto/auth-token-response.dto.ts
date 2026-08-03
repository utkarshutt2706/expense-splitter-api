import { AuthUserResponseDto } from './auth-user-response.dto';

export class AuthTokenResponseDto {
    user: AuthUserResponseDto;
    accessToken: string;
}
