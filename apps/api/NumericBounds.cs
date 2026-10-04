namespace Fylkren.Api;

internal static class NumericBounds
{
    internal static int NextVersion(int current)
    {
        if (current < 0 || current == int.MaxValue) throw new NumericCapacityException();
        return current + 1;
    }

    internal static long NextVersion(long current)
    {
        if (current < 0 || current == long.MaxValue) throw new NumericCapacityException();
        return current + 1;
    }

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

    internal static long PageForZeroBasedIndex(long index, int pageSize)
    {
        if (index < 0 || pageSize < 1) throw new ArgumentOutOfRangeException();
        return index / pageSize + 1;
    }
}

internal sealed class NumericCapacityException() : InvalidOperationException("The resource has reached its numeric limit.");
