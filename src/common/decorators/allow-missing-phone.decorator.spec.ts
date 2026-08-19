import { ALLOW_MISSING_PHONE_KEY, AllowMissingPhone } from './allow-missing-phone.decorator';

class TestController {
    @AllowMissingPhone()
    update(this: void): void {}
}

@AllowMissingPhone()
class TestClassController {}

describe('AllowMissingPhone', () => {
    it('marks a route as allowing users without a phone number', () => {
        expect(Reflect.getMetadata(ALLOW_MISSING_PHONE_KEY, TestController.prototype.update)).toBe(
            true,
        );
    });

    it('can mark a controller class with the same metadata', () => {
        expect(Reflect.getMetadata(ALLOW_MISSING_PHONE_KEY, TestClassController)).toBe(true);
    });
});
