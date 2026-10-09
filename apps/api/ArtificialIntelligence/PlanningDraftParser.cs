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
        PlanningDraft[] numbered;
        try
        {
            var candidates = ReadCandidates(ParseFirstJsonValue(value), names);
            if (candidates.Count != templates.Count) throw new JsonException();
            numbered = candidates.Select((candidate, index) => ReadCandidate(candidate, index, names)).ToArray();
        }
        catch (JsonException)
        {
            try { numbered = ReadTagged(value, templates.Count); }
            catch (JsonException) { numbered = ReadHeadingSections(value, names); }
        }
        if (numbered.Select(value => value.StepNumber).Order().SequenceEqual(Enumerable.Range(0, templates.Count)))
            numbered = numbered.Select(value => value with { StepNumber = value.StepNumber + 1 }).ToArray();
        var drafts = numbered.OrderBy(value => value.StepNumber).ToArray();
        if (!drafts.Select(value => value.StepNumber).SequenceEqual(Enumerable.Range(1, templates.Count))) throw new JsonException();
        return drafts.Select(draft => draft with { Content = NormalizeTemplateStructure(names[draft.StepNumber - 1], templates[draft.StepNumber - 1], draft.Content) }).ToArray();
    }

    private static PlanningDraft[] ReadTagged(string value, int expectedCount)
    {
        var options = RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant;
        var openings = Regex.Matches(value, @"\[\[\s*STEP\s*:?\s*(\d+)\s*\]\]", options);
        if (openings.Count != expectedCount) throw new JsonException();
        return openings.Select((opening, index) =>
        {
            if (!int.TryParse(opening.Groups[1].Value, out var number)) throw new JsonException();
            var end = index + 1 < openings.Count ? openings[index + 1].Index : value.Length;
            var content = value[(opening.Index + opening.Length)..end];
            var closing = Regex.Match(content, @"\[\[\s*(?:END[\s_-]*STEP|/STEP)\s*\]\]", options);
            if (closing.Success) content = content[..closing.Index];
            return new PlanningDraft(number, BoundedText(content));
        }).ToArray();
    }

    private static PlanningDraft[] ReadHeadingSections(string value, IReadOnlyList<string> names)
    {
        var lines = value.Replace("\r\n", "\n").Split('\n');
        var sections = new List<(int Number, int Line)>();
        for (var index = 0; index < lines.Length; index++)
        {
            var match = Regex.Match(lines[index], @"^\s*#{1,4}\s+(?:\d+[.)]\s*)?(.+?)\s*$", RegexOptions.CultureInvariant);
            if (!match.Success) continue;
            var matches = names.Select((name, number) => new { name, number }).Where(candidate => Same(candidate.name, match.Groups[1].Value)).ToArray();
            if (matches.Length == 1) sections.Add((matches[0].number + 1, index));
        }
        if (sections.Count != names.Count || !sections.Select(section => section.Number).SequenceEqual(Enumerable.Range(1, names.Count))) throw new JsonException();
        return sections.Select((section, index) =>
        {
            var end = index + 1 < sections.Count ? sections[index + 1].Line : lines.Length;
            var content = string.Join('\n', lines[(section.Line + 1)..end]).Trim();
            if (content.EndsWith("```", StringComparison.Ordinal)) content = content[..^3].TrimEnd();
            return new PlanningDraft(section.Number, BoundedText(content));
        }).ToArray();
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
        return BoundedText(value.GetString() ?? "");
    }

    private static string BoundedText(string value) => value.Trim() is { Length: >= 1 and <= 20_000 } text ? text : throw new JsonException();

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

    private static string NormalizeTemplateStructure(string stepName, string template, string draft)
    {
        static (int Index, string Text, string Kind)[] Markers(string[] lines) => lines.Select((line, index) => new { line = Regex.Replace(line.Trim(), @"\s+", " "), index })
            .Where(value => Regex.IsMatch(value.line, @"^#{1,4}\s+\S") || Regex.IsMatch(value.line, @"^[-*]\s+\[[ xX]\]\s+\S"))
            .Select(value => (value.index, value.line, value.line.StartsWith('#') ? value.line[..value.line.IndexOf(' ')] : "check")).ToArray();
        static string HeadingText(string value) => Regex.Replace(value.Trim(), @"^#{1,4}\s+(?:\d+[.)]\s*)?", "").Trim();
        bool IsStepHeading((int Index, string Text, string Kind) marker) => marker.Kind.StartsWith('#') && Same(HeadingText(marker.Text), stepName);
        var templateMarkers = Markers(template.Replace("\r\n", "\n").Split('\n'));
        var templateHasStepHeading = templateMarkers.Any(IsStepHeading);
        var required = templateMarkers.Where(marker => !IsStepHeading(marker)).ToArray();
        var lines = draft.Replace("\r\n", "\n").Split('\n'); var actual = Markers(lines);
        var seenHeadings = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var firstHeadingIndex = actual.FirstOrDefault(marker => marker.Kind.StartsWith('#')).Index;
        foreach (var marker in actual.Where(marker => marker.Kind.StartsWith('#')))
        {
            var matchesSubheading = required.Any(candidate => candidate.Kind.StartsWith('#') && Same(HeadingText(candidate.Text), HeadingText(marker.Text)));
            if (IsStepHeading(marker) || (templateHasStepHeading && marker.Index == firstHeadingIndex && !matchesSubheading) ||
                (Regex.IsMatch(HeadingText(marker.Text), @"^step\s*\d+$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant) &&
                !required.Any(candidate => Same(HeadingText(candidate.Text), HeadingText(marker.Text)))))
            {
                lines[marker.Index] = "";
                continue;
            }
            var canonical = required.FirstOrDefault(candidate => candidate.Kind.StartsWith('#') && Same(HeadingText(candidate.Text), HeadingText(marker.Text)));
            if (!string.IsNullOrEmpty(canonical.Text)) lines[marker.Index] = canonical.Text;
            var heading = HeadingText(lines[marker.Index]);
            if (!seenHeadings.Add(heading)) lines[marker.Index] = "";
        }
        return string.Join('\n', lines).Trim();
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
