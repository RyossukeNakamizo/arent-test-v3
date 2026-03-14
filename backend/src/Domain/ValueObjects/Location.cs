using IssueManager.Api.Domain.Enums;

namespace IssueManager.Api.Domain.ValueObjects;

/// <summary>
/// 位置情報（値オブジェクト）
/// 部材指摘(Element) → dbId 必須 / 空間指摘(Space) → worldPosition 必須
/// 両対応: dbId + worldPosition 両方持つケースも許容
/// </summary>
public class Location
{
    public LocationType Type { get; private set; }
    public int? DbId { get; private set; }
    public WorldPosition? WorldPosition { get; private set; }

    // EF Core用パラメータレスコンストラクタ
    private Location() { }

    public Location(LocationType type, int? dbId, WorldPosition? worldPosition)
    {
        if (type == LocationType.Element && dbId is null)
            throw new ArgumentException("部材指摘には dbId が必須です");
        if (type == LocationType.Space && worldPosition is null)
            throw new ArgumentException("空間指摘には worldPosition が必須です");

        Type = type;
        DbId = dbId;
        WorldPosition = worldPosition;
    }
}

/// <summary>3D空間上の座標（値オブジェクト）</summary>
public class WorldPosition
{
    public double X { get; private set; }
    public double Y { get; private set; }
    public double Z { get; private set; }

    // EF Core用パラメータレスコンストラクタ
    private WorldPosition() { }

    public WorldPosition(double x, double y, double z)
    {
        X = x;
        Y = y;
        Z = z;
    }
}
