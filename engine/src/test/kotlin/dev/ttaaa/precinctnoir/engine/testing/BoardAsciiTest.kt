package dev.ttaaa.precinctnoir.engine.testing

import dev.ttaaa.precinctnoir.engine.core.board.Officer
import dev.ttaaa.precinctnoir.engine.core.board.TokenKind
import dev.ttaaa.precinctnoir.engine.core.ids.SuspectId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.checkAll

class BoardAsciiTest : FunSpec({
    test("parses every flag") {
        val tile = BoardAscii.parseCell("12+aoTPHB")
        tile.id shouldBe SuspectId(12)
        tile.exonerated shouldBe true
        tile.arrested shouldBe true
        tile.officer shouldBe Officer()
        tile.tokens shouldBe TokenKind.entries
        BoardAscii.parseCell("3s").officer shouldBe Officer(stunned = true)
        BoardAscii.parseCell("4x").alive shouldBe false
    }

    test("render is the inverse of parse for every board") {
        checkAll(Arbs.board()) { board -> BoardAscii.parse(BoardAscii.render(board), board.removed.map(SuspectId::value)) shouldBe board }
    }

    test("rejects ragged rows and unknown flags") {
        shouldThrow<IllegalArgumentException> { BoardAscii.parse("0 1\n2") }
        shouldThrow<IllegalArgumentException> { BoardAscii.parse("") }
        shouldThrow<IllegalArgumentException> { BoardAscii.parseCell("7q") }
        shouldThrow<IllegalArgumentException> { BoardAscii.parseCell("x") }
    }
})
