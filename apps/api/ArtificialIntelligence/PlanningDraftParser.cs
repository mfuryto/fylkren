using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Fylkren.Api.ArtificialIntelligence;

internal static class PlanningDraftParser
{
    private static readonly string[] CollectionNames = ["steps", "planningSteps", "planSteps"];
    private static readonly string[] NumberNames = ["stepNumber", "step_number", "number", "step"];
    private static readonly string[] StepNameNames = ["stepName", "step_name", "name", "title"];
    private static readonly string[] ContentNames = ["content", "draft", "text", "markdown"];

    internal static PlanningDraft[] Parse(string value, IReadOnlyList<string> names, IReadOnlyList<string> templates)
    {
        if (templates.Count is < 1 or > 50 || names.Count != templates.Count) throw new JsonException();
        var root = ParseFirstJsonValue(value);
        var candidates = ReadCandidates(root, names);
        if (candidates.Count != templates.Count) throw new JsonException();
        var numbered = candidates.Select((candidate, index) => ReadCandidate(candidate, index, names)).ToArray();
        if (numbered.Select(value => value.StepNumber).Order().SequenceEqual(Enumerable.Range(0, templates.Count)))
            numbered = numbered.Select(value => value with { StepNumber = value.StepNumber + 1 }).ToArray();
        var drafts = numbered.OrderBy(value => value.StepNumber).ToArray();
        if (!drafts.Select(value => value.StepNumber).SequenceEqual(Enumerable.Range(1, templates.Count))) throw new JsonException();
        foreach (var draft in drafts) EnsureTemplateStructure(templates[draft.StepNumber - 1], draft.Content);
        return drafts;
    }

    private static IReadOnlyList<JsonElement> ReadCandidates(JsonElement root, IReadOnlyList<string> names)
    {
        if (root.ValueKind == JsonValueKind.Array) return root.EnumerateArray().Select(value => value.Clone()).ToArray();
        if (root.ValueKind != JsonValueKind.Object) throw new JsonException();
        foreach (var collectionName in CollectionNames)
        {
            if (!TryProperty(root, collectionName, out var collection)) continue;
            if (collection.ValueKind == JsonValueKind.Array) return collection.EnumerateArray().Select(value => value.Clone()).ToArray();
            if (collection.ValueKind == JsonValueKind.Object) return ReadNamedObject(collection, names);
        }
        return ReadNamedObject(root, names);
    }

    private static IReadOnlyList<JsonElement> ReadNamedObject(JsonElement value, IReadOnlyList<string> names)
    {
        var properties = value.EnumerateObject().ToArray();
        if (properties.Length != names.Count) throw new JsonException();
        return names.Select(name =>
        {
            var matches = properties.Where(property => Same(property.Name, name)).ToArray();
            return matches.Length == 1 ? matches[0].Value.Clone() : throw new JsonException();
        }).ToArray();
    }

    private static PlanningDraft ReadCandidate(JsonElement candidate, int index, IReadOnlyList<string> names)
    {
        if (candidate.ValueKind == JsonValueKind.String)
            return new PlanningDraft(index + 1, ReadText(candidate));
        if (candidate.ValueKind != JsonValueKind.Object) throw new JsonException();
        var content = ContentNames.Select(name => TryProperty(candidate, name, out var value) ? value : default)
            .FirstOrDefault(value => value.ValueKind == JsonValueKind.String);
        if (content.ValueKind != JsonValueKind.String) throw new JsonException();
        var stepNumber = NumberNames.Select(name => TryProperty(candidate, name, out var value) ? ReadNumber(value) : null).FirstOrDefault(value => value.HasValue);
        if (stepNumber is null)
        {
            var suppliedName = StepNameNames.Select(name => TryProperty(candidate, name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null)
                .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
            stepNumber = suppliedName is null ? index + 1 : MatchName(suppliedName, names);
        }
        return new PlanningDraft(stepNumber.Value, ReadText(content));
    }

    private static int MatchName(string suppliedName, IReadOnlyList<string> names)
    {
        var matches = names.Select((name, index) => new { name, index }).Where(value => Same(value.name, suppliedName)).ToArray();
        return matches.Length == 1 ? matches[0].index + 1 : throw new JsonException();
    }

    private static int? ReadNumber(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) return number;
        return value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out number) ? number : null;
    }

    private static string ReadText(JsonElement value)
    {
        var text = value.GetString()?.Trim() ?? "";
        return text.Length is >= 1 and <= 20_000 ? text : throw new JsonException();
    }

    private static JsonElement ParseFirstJsonValue(string value)
    {
        var text = value.Trim();
        if (text.StartsWith("```", StringComparison.Ordinal))
        {
            var firstBreak = text.IndexOf('\n'); var lastFence = text.LastIndexOf("```", StringComparison.Ordinal);
            if (firstBreak >= 0 && lastFence > firstBreak) text = text[(firstBreak + 1)..lastFence].Trim();
        }
        var attempts = 0;
        for (var index = 0; index < text.Length && attempts < 16; index++)
        {
            if (text[index] is not ('{' or '[')) continue;
            attempts++;
            try
            {
                var reader = new Utf8JsonReader(Encoding.UTF8.GetBytes(text[index..]), new JsonReaderOptions { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip, MaxDepth = 8 });
                using var document = JsonDocument.ParseValue(ref reader);
                return document.RootElement.Clone();
            }
            catch (JsonException) { }
        }
        throw new JsonException();
    }

    private static void EnsureTemplateStructure(string template, string draft)
    {
        static string[] Markers(string content) => content.Replace("\r\n", "\n").Split('\n').Select(line => Regex.Replace(line.Trim(), @"\s+", " "))
            .Where(line => Regex.IsMatch(line, @"^#{1,4}\s+\S") || Regex.IsMatch(line, @"^[-*]\s+\[[ xX]\]\s+\S")).ToArray();
        var actual = Markers(draft); var position = 0;
        foreach (var marker in Markers(template))
        {
            while (position < actual.Length && !Same(actual[position], marker)) position++;
            if (position == actual.Length) throw new JsonException();
            position++;
        }
    }

    private static bool TryProperty(JsonElement value, string name, out JsonElement result)
    {
        foreach (var property in value.EnumerateObject())
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)) { result = property.Value; return true; }
        result = default; return false;
    }

    private static bool Same(string left, string right) => string.Equals(Regex.Replace(left.Trim(), @"\s+", " "), Regex.Replace(right.Trim(), @"\s+", " "), StringComparison.OrdinalIgnoreCase);
}

internal sealed record PlanningDraft(int StepNumber, string Content);
