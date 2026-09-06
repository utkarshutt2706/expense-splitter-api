import {
    registerDecorator,
    type ValidationArguments,
    type ValidationOptions,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isNotFutureDate', async: false })
class IsNotFutureDateConstraint implements ValidatorConstraintInterface {
    validate(value: unknown, args: ValidationArguments): boolean {
        if (typeof value !== 'string') return false;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return false;

        const { timeZone = 'UTC' } = args.object as { timeZone?: unknown };
        if (typeof timeZone !== 'string') return false;

        let todayValue: string;
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).formatToParts(new Date());
            const part = (type: Intl.DateTimeFormatPartTypes) =>
                parts.find((entry) => entry.type === type)?.value;
            todayValue = `${part('year')}-${part('month')}-${part('day')}`;
        } catch {
            return false;
        }

        // paidOn represents a calendar date, not an instant to shift between zones.
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
