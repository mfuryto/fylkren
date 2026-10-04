namespace Fylkren.Api;

internal static class NumericBounds
{
    internal static long AddCount(long total, long count)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(total);
        ArgumentOutOfRangeException.ThrowIfNegative(count);
        return checked(total + count);
    }

    // Avoid total + pageSize - 1 and floating-point/narrowing conversions.
    internal static long Pages(long total, int pageSize)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(total);
        ArgumentOutOfRangeException.ThrowIfLessThan(pageSize, 1);
        return total / pageSize + (total % pageSize == 0 ? 0 : 1);
    }
}
