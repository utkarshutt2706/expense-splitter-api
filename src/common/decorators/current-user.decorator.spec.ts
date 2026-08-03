import { ExecutionContext } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';

type ParamDecoratorFactory = (data: unknown, context: ExecutionContext) => unknown;

// Nest wraps createParamDecorator factories in metadata rather than exposing them
// directly; this extracts the underlying factory so it can be unit tested in
// isolation, per Nest's own documented pattern for testing custom decorators.
function getParamDecoratorFactory(
    decorator: (...args: unknown[]) => ParameterDecorator,
): ParamDecoratorFactory {
    class TestDecorator {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        public test(@decorator() _value: unknown): void {}
    }

    const args = Reflect.getMetadata('__routeArguments__', TestDecorator, 'test') as Record<
        string,
        { factory: ParamDecoratorFactory }
    >;
    return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser', () => {
    it('extracts the user attached to the request by the auth guard', () => {
        const factory = getParamDecoratorFactory(CurrentUser);
        const payload = { sub: 'user-1', email: 'user@example.com' };
        const context = {
            switchToHttp: () => ({
                getRequest: () => ({ user: payload }),
            }),
        } as unknown as ExecutionContext;

        expect(factory(undefined, context)).toEqual(payload);
    });
});
