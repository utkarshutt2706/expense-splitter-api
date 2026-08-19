import { SetMetadata } from '@nestjs/common';

export const ALLOW_MISSING_PHONE_KEY = 'allowMissingPhone';

export const AllowMissingPhone = (): ReturnType<typeof SetMetadata> =>
    SetMetadata(ALLOW_MISSING_PHONE_KEY, true);
