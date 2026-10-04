using Fylkren.Api;

internal static class NumericArithmeticTests
{
    internal static void Run()
    {
        void Require(bool value, string message) { if (!value) throw new Exception(message); }
        void Reject(Action action)
        {
            try { action(); }
            catch (Exception error) when (error is OverflowException or ArgumentOutOfRangeException) { return; }
            throw new Exception("Unsafe count arithmetic was accepted.");
        }
        Require(NumericBounds.AddCount(int.MaxValue, int.MaxValue) == 4_294_967_294L, "Combined counts wrapped at the former int boundary.");
        Require(NumericBounds.AddCount(NumericBounds.AddCount(int.MaxValue, int.MaxValue), int.MaxValue) == 6_442_450_941L, "Three delivery totals wrapped or lost a blocker.");
        Require(NumericBounds.AddCount(long.MaxValue - 1, 1) == long.MaxValue, "Last representable count was rejected.");
        Reject(() => NumericBounds.AddCount(long.MaxValue, 1));
        Reject(() => NumericBounds.AddCount(-1, 1));
        Reject(() => NumericBounds.AddCount(1, -1));
        foreach (var (total, expected) in new (long, long)[] { (0, 0), (1, 1), (19, 1), (20, 1), (21, 2), (int.MaxValue, 107_374_183), (long.MaxValue, 461_168_601_842_738_791) })
            Require(NumericBounds.Pages(total, 20) == expected, "Page count overflowed, narrowed or lost its exact final page.");
        Require(NumericBounds.Pages(long.MaxValue, 1) == long.MaxValue, "Full-range pages overflowed.");
        foreach (var (index, size, expected) in new (long, int, long)[] {
            (0, 20, 1), (19, 20, 1), (20, 20, 2), (int.MaxValue, 20, 107_374_183),
            (long.MaxValue, 20, 461_168_601_842_738_791) })
            Require(NumericBounds.PageForZeroBasedIndex(index, size) == expected,
                "Focused page arithmetic overflowed or narrowed its zero-based rank.");
        Reject(() => NumericBounds.Pages(-1, 20));
        Reject(() => NumericBounds.Pages(1, 0));
        Reject(() => NumericBounds.Pages(1, -1));
        Reject(() => NumericBounds.PageForZeroBasedIndex(-1, 20));
        Reject(() => NumericBounds.PageForZeroBasedIndex(1, 0));
        Console.WriteLine("Arithmetic boundary tests passed: combined counts, exact total/focused pages through long-max and rejected overflow/sign/zero inputs. No billion-row database fixture was simulated.");
    }
}
