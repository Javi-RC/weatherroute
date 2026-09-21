using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Entities;

public sealed class RouteSegment
{
    public RouteSegment(Coordinates start, Coordinates end, Distance distance,
        TimeSpan estimatedDuration, int startPointIndex, int endPointIndex)
    {
        Start = start;
        End = end;
        Distance = distance;
        EstimatedDuration = estimatedDuration;
        StartPointIndex = startPointIndex;
        EndPointIndex = endPointIndex;
    }

    public Coordinates Start { get; }
    public Coordinates End { get; }
    public Distance Distance { get; }
    public TimeSpan EstimatedDuration { get; }
    public int StartPointIndex { get; }
    public int EndPointIndex { get; }
    public WeatherSnapshot? Weather { get; private set; }
    public TimeSpan? ArrivalTime { get; private set; }
    public bool HasWeather => Weather is not null;

    public void AssignWeather(WeatherSnapshot weather) => Weather = weather;
    public void SetArrival(TimeSpan arrival) => ArrivalTime = arrival;
}
