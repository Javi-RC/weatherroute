namespace WeatherRoute.Domain.ValueObjects;

public sealed record Duration
{
    public Duration(TimeSpan value)
    {
        if (value < TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(value));
        Value = value;
    }

    public TimeSpan Value { get; }
    public int TotalMinutesCeiled => (int)Math.Ceiling(Value.TotalMinutes);
}
