package dev.ttaaa.precinctnoir.engine.core.board

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

class HeistGeometryTest : FunSpec({
    val city = Grid(7, 7)

    test("HX-1: each vault zone is its 3x3 corner block") {
        HeistGeometry.zone(city, Quadrant.NW) shouldContainExactly (0..2).flatMap { r -> (0..2).map { Pos(r, it) } }
        HeistGeometry.zone(city, Quadrant.SE) shouldContainExactly (4..6).flatMap { r -> (4..6).map { Pos(r, it) } }
        Quadrant.entries.forEach { HeistGeometry.zone(city, it) shouldHaveSize 9 }
        HeistGeometry.quadrantOf(city, Pos(0, 6)) shouldBe Quadrant.NE
        HeistGeometry.quadrantOf(city, Pos(6, 0)) shouldBe Quadrant.SW
    }

    test("the middle row and column form the cross, which belongs to no zone") {
        city.positions.count { HeistGeometry.isCross(city, it) } shouldBe 13
        HeistGeometry.quadrantOf(city, Pos(3, 0)).shouldBeNull()
        HeistGeometry.centre(city) shouldBe Pos(3, 3)
        HeistGeometry.isCentre(city, Pos(3, 3)) shouldBe true
        HeistGeometry.isCentre(city, Pos(3, 2)) shouldBe false
    }

    test("zones touching a cell: two from the cross edge, all four from the centre") {
        HeistGeometry.quadrantsTouching(city, Pos(3, 0)) shouldContainExactly listOf(Quadrant.NW, Quadrant.SW)
        HeistGeometry.quadrantsTouching(city, Pos(0, 3)) shouldContainExactly listOf(Quadrant.NW, Quadrant.NE)
        HeistGeometry.quadrantsTouching(city, Pos(3, 3)) shouldContainExactly Quadrant.entries
        HeistGeometry.quadrantsTouching(city, Pos(0, 0)) shouldContainExactly listOf(Quadrant.NW)
    }

    test("needs an odd square city") {
        shouldThrow<IllegalArgumentException> { HeistGeometry.centre(Grid(6, 6)) }
        shouldThrow<IllegalArgumentException> { HeistGeometry.centre(Grid(7, 5)) }
        shouldThrow<IllegalArgumentException> { HeistGeometry.centre(Grid(1, 1)) }
        shouldThrow<IllegalArgumentException> { HeistGeometry.quadrantOf(city, Pos(7, 0)) }
    }
})
