using System.Collections.Concurrent;
using System.Text.RegularExpressions;

namespace Fylkren.Api.Platform;

public sealed record TechnicalLogEntry(
    long Sequence,
    DateTimeOffset OccurredAt,
    string Level,
    string Category,
    int EventId,
    string Message,
    string? ExceptionType);

public sealed class TechnicalLogBuffer(int capacity) : ILoggerProvider
{
    private const string Redacted = "[REDACTED]";
    private static readonly Regex HeaderSecret = new(
        @"(?im)\b(authorization|cookie|set-cookie)\s*:\s*[^\r\n]+",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex NamedSecret = new(
        """(?i)\b(password|passwd|pwd|client[_-]?secret|secret|totp[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_ -]?key|reset[_-]?code|recovery[_-]?code|activation[_-]?code)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^;\s,]+)""",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex BearerSecret = new(
        @"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex QuerySecret = new(
        @"(?i)([?&](?:access_token|refresh_token|id_token|code|reset_code|recovery_code|activation_code|token|key|secret|password)=)[^&#\s]+",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex UriCredentials = new(
        @"(?i)(://)[^/@:\s]+:[^/@\s]+@",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex UnsafeLogControls = new(
        @"[\r\n\t\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private readonly ConcurrentQueue<TechnicalLogEntry> entries = new();
    private long sequence;

    public ILogger CreateLogger(string categoryName) => new BufferLogger(this, categoryName);
    public void Dispose() { }

    public IReadOnlyList<TechnicalLogEntry> Read(LogLevel minimumLevel, string? search, int limit)
    {
        var term = search?.Trim();
        return entries
            .Where(entry => ParseLevel(entry.Level) >= minimumLevel &&
                (string.IsNullOrWhiteSpace(term) ||
                 entry.Category.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                 entry.Message.Contains(term, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(entry => entry.Sequence)
            .Take(Math.Clamp(limit, 1, 300))
            .ToList();
    }

    private void Add(LogLevel level, string category, EventId eventId, string message, Exception? exception)
    {
        if (level < LogLevel.Warning) return;
        var safeMessage = Sanitize(message);
        entries.Enqueue(new TechnicalLogEntry(
            Interlocked.Increment(ref sequence),
            DateTimeOffset.UtcNow,
            level.ToString(),
            category,
            eventId.Id,
            safeMessage,
            exception?.GetType().FullName));
        while (entries.Count > capacity) entries.TryDequeue(out _);
    }

    private static LogLevel ParseLevel(string value) =>
        Enum.TryParse<LogLevel>(value, out var level) ? level : LogLevel.None;

    internal static string Sanitize(string message)
    {
        var value = HeaderSecret.Replace(message, match => $"{match.Groups[1].Value}: {Redacted}");
        value = NamedSecret.Replace(value, match => $"{match.Groups[1].Value}={Redacted}");
        value = BearerSecret.Replace(value, $"Bearer {Redacted}");
        value = QuerySecret.Replace(value, match => $"{match.Groups[1].Value}{Redacted}");
        value = UriCredentials.Replace(value, match => $"{match.Groups[1].Value}{Redacted}@");
        value = UnsafeLogControls.Replace(value, " ");
        return value.Length > 2000 ? value[..2000] : value;
    }

    private sealed class BufferLogger(TechnicalLogBuffer owner, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Warning;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (IsEnabled(logLevel)) owner.Add(logLevel, category, eventId, formatter(state, exception), exception);
        }
    }
}
