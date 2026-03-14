using Xunit;
using IssueManager.Api.Domain.Enums;
using IssueManager.Api.Domain.ValueObjects;

namespace IssueManager.Api.Tests.Domain.ValueObjects;

public class LocationTests
{
    // ── 部材指摘（Element）────────────────────────────────

    [Fact]
    public void Element_WithValidDbId_CreatesElementLocation()
    {
        var location = new Location(LocationType.Element, dbId: 1234, worldPosition: null);
        Assert.Equal(LocationType.Element, location.Type);
        Assert.Equal(1234, location.DbId);
        Assert.Null(location.WorldPosition);
    }

    [Fact]
    public void Element_WithDbIdAndWorldPosition_CreatesLocationWithBoth()
    {
        var pos = new WorldPosition(10.0, 20.0, 30.0);
        var location = new Location(LocationType.Element, dbId: 1234, worldPosition: pos);
        Assert.Equal(LocationType.Element, location.Type);
        Assert.Equal(1234, location.DbId);
        Assert.NotNull(location.WorldPosition);
        Assert.Equal(10.0, location.WorldPosition!.X);
    }

    [Fact]
    public void Element_WithNullDbId_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() =>
            new Location(LocationType.Element, dbId: null, worldPosition: null)
        );
    }

    // ── 空間指摘（Space）─────────────────────────────────

    [Fact]
    public void Space_WithValidWorldPosition_CreatesSpaceLocation()
    {
        var pos = new WorldPosition(10.0, 20.0, 30.0);
        var location = new Location(LocationType.Space, dbId: null, worldPosition: pos);
        Assert.Equal(LocationType.Space, location.Type);
        Assert.Null(location.DbId);
        Assert.NotNull(location.WorldPosition);
        Assert.Equal(10.0, location.WorldPosition!.X);
        Assert.Equal(20.0, location.WorldPosition!.Y);
        Assert.Equal(30.0, location.WorldPosition!.Z);
    }

    [Fact]
    public void Space_WithNullWorldPosition_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() =>
            new Location(LocationType.Space, dbId: null, worldPosition: null)
        );
    }

    [Fact]
    public void Space_WithDbIdAndWorldPosition_CreatesLocationWithBoth()
    {
        var pos = new WorldPosition(5.0, 10.0, 15.0);
        var location = new Location(LocationType.Space, dbId: 999, worldPosition: pos);
        Assert.Equal(LocationType.Space, location.Type);
        Assert.Equal(999, location.DbId);
        Assert.NotNull(location.WorldPosition);
    }

    // ── WorldPosition ────────────────────────────────────

    [Fact]
    public void WorldPosition_WithValidCoordinates_StoresValues()
    {
        var pos = new WorldPosition(1.5, 2.5, 3.5);
        Assert.Equal(1.5, pos.X);
        Assert.Equal(2.5, pos.Y);
        Assert.Equal(3.5, pos.Z);
    }

    [Fact]
    public void WorldPosition_WithNegativeCoordinates_StoresValues()
    {
        var pos = new WorldPosition(-10.0, -20.0, -30.0);
        Assert.Equal(-10.0, pos.X);
        Assert.Equal(-20.0, pos.Y);
        Assert.Equal(-30.0, pos.Z);
    }

    [Fact]
    public void WorldPosition_WithZeroCoordinates_StoresValues()
    {
        var pos = new WorldPosition(0, 0, 0);
        Assert.Equal(0, pos.X);
        Assert.Equal(0, pos.Y);
        Assert.Equal(0, pos.Z);
    }
}
