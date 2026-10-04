using System.Data.Common;
using System.Diagnostics;
using System.Text.Json;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;

// Scope only the navigation-count database work, using the same immutable fixture
// and interleaving old/new rounds. No HTTP/proxy or production sizing claim.
internal static class NavigationCountMeasurements
{
    internal static async Task Run(FylkrenDbContext source, Guid person)
    {
        var connection = source.Database.GetConnectionString()!;
        var expected = await NavigationCountReference.Read(person, source, default);
        foreach (var baseline in new[] { true, false })
        {
            var capture = new Capture();
            await using var db = Context(capture);
            var value = await Read(baseline, db);
            if (value != expected) throw new Exception("Measured totals differ.");
            for (var index = 0; index < capture.Statements.Count; index++)
            {
                var sql = capture.Statements[index];
                await using var conn = new NpgsqlConnection(connection); await conn.OpenAsync();
                await using var command = new NpgsqlCommand("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + sql.Text, conn);
                foreach (var p in sql.Parameters) command.Parameters.Add(p);
                using var plan = JsonDocument.Parse((string)(await command.ExecuteScalarAsync())!);
                var root = plan.RootElement[0];
                var output = Environment.GetEnvironmentVariable("FYLKREN_NAVIGATION_EVIDENCE_DIR");
                if (output is not null)
                {
                    Directory.CreateDirectory(output);
                    await File.WriteAllTextAsync(Path.Combine(output, $"{(baseline ? "before" : "after")}-plan-{index}.json"), root.GetRawText());
                    await File.WriteAllTextAsync(Path.Combine(output, $"{(baseline ? "before" : "after")}-query-{index}.sql"), sql.Text);
                }
                Console.WriteLine(JsonSerializer.Serialize(new { navigationPlan = baseline ? "before" : "after", siteQuery = index, sqlCharacters = sql.Text.Length,
                    planningMs = root.GetProperty("Planning Time").GetDouble(), executionMs = root.GetProperty("Execution Time").GetDouble(),
                    outputRows = root.GetProperty("Plan").GetProperty("Actual Rows").GetDouble(),
                    jit = root.TryGetProperty("JIT", out var jit) ? (JsonElement?)jit : null }));
                if (!baseline && (sql.Text.Contains("final_report") || sql.Text.Contains("ORDER BY")))
                    throw new Exception("Counter query regressed to sorted card/report materialization.");
            }
        }
        // Warm both LINQ/query paths and database pools before timed rounds.
        for (var i = 0; i < 4; i++) foreach (var baseline in new[] { true, false }) { await using var db = Context(); await Read(baseline, db); }
        foreach (var concurrency in new[] { 1, 10, 25 })
        {
            foreach (var round in new[] { 0, 1 })
            foreach (var baseline in round == 0 ? new[] { true, false } : new[] { false, true })
            {
                var times = new System.Collections.Concurrent.ConcurrentBag<double>(); var next = -1;
                await Task.WhenAll(Enumerable.Range(0, concurrency).Select(async _ =>
                {
                    await using var db = Context();
                    while (Interlocked.Increment(ref next) < 25)
                    {
                        var timer = Stopwatch.StartNew(); var value = await Read(baseline, db);
                        times.Add(timer.Elapsed.TotalMilliseconds);
                        if (value != expected) throw new Exception("Concurrent counts changed or broadened authorization.");
                    }
                }));
                var samples = times.Order().ToArray();
                Console.WriteLine(JsonSerializer.Serialize(new { navigationMeasurement = baseline ? "before" : "after", concurrency, round, requests = samples.Length,
                    p50Ms = Math.Round(samples[12], 2), p95Ms = Math.Round(samples[23], 2), maxMs = Math.Round(samples[^1], 2), counts = expected }));
            }
        }
        FylkrenDbContext Context(Capture? capture = null)
        {
            var builder = new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection);
            if (capture is not null) builder.AddInterceptors(capture);
            return new(builder.Options);
        }
        Task<WorkNavigationCountEndpoints.Counts> Read(bool baseline, FylkrenDbContext db) => baseline ? NavigationCountReference.Read(person, db, default) : WorkNavigationCountEndpoints.Read(person, db, default);
    }
    private sealed record Sql(string Text, NpgsqlParameter[] Parameters);
    private sealed class Capture : DbCommandInterceptor
    {
        internal List<Sql> Statements = [];
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("work_item_dependencies"))
                Statements.Add(new(command.CommandText, command.Parameters.Cast<NpgsqlParameter>().Select(p => new NpgsqlParameter(p.ParameterName, p.NpgsqlDbType) { Value = p.Value }).ToArray()));
            return ValueTask.FromResult(result);
        }
    }
}
