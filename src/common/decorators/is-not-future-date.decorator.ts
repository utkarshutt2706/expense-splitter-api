import {
    registerDecorator,
    type ValidationArguments,
    type ValidationOptions,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isNotFutureDate', async: false })
class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
        if (typeof value !== 'string') return false;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return false;

        const today = new Date();
        const todayValue = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            String(today.getDate()).padStart(2, '0'),
        ].join('-');

        return value.slice(0, 10) <= todayValue;
    }

    defaultMessage(args: ValidationArguments): string {
        return `${args.property} must not be a future date`;
    }
}

export function IsNotFutureDate(validationOptions?: ValidationOptions): PropertyDecorator {
    return (target: object, propertyKey: string | symbol) => {
        registerDecorator({
            target: target.constructor,
            propertyName: propertyKey.toString(),
            options: validationOptions,
            validator: IsNotFutureDateConstraint,
        });
    };
}
