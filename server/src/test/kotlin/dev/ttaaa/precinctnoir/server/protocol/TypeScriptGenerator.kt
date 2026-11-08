package dev.ttaaa.precinctnoir.server.protocol

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.descriptors.elementNames
import kotlinx.serialization.serializer
import kotlin.reflect.KClass
import kotlin.reflect.KType
import kotlin.reflect.full.memberProperties
import kotlin.reflect.full.primaryConstructor
import kotlin.reflect.full.starProjectedType

/**
 * Emits TypeScript declarations for `@Serializable` Kotlin types, matching how `ProtocolJson` encodes them:
 * sealed hierarchies become unions discriminated by `t`, enums become string-literal unions, value classes
 * become aliases, and nullable fields become optional (nulls are omitted on the wire).
 *
 * Names come from the Kotlin class, with enclosing classes prefixed (`ServerMessage.Room` → `ServerMessageRoom`).
 * Two different classes may not share a name: TypeScript would silently merge them into one type, so generation
 * fails instead (give mode-specific types the mode's prefix, like `ShadowDuelRole`).
 */
class TypeScriptGenerator {
    private val declarations = LinkedHashMap<String, String>()
    private val owners = HashMap<String, KClass<*>>()

    fun generate(roots: List<KClass<*>>): String {
        roots.forEach(::declare)
        return HEADER + declarations.values.joinToString("\n\n") + "\n"
    }

    private fun declare(cls: KClass<*>): String {
        val name = nameOf(cls)
        val owner = owners.getOrPut(name) { cls }
        require(owner == cls) { "Two protocol types are both called $name: ${owner.qualifiedName} and ${cls.qualifiedName}. Rename one." }
        if (name in declarations) return name
        declarations[name] = "" // reserve the slot: parents are emitted before the types they mention
        declarations[name] = when {
            cls.java.isEnum -> {
                val values = serializer(cls.starProjectedType).descriptor.elementNames.joinToString(" | ") { "'$it'" }
                "export type $name = $values"
            }
            cls.isValue -> "export type $name = ${typeOf(cls.primaryConstructor!!.parameters.single().type)}"
            cls.isSealed -> "export type $name =\n" + cls.sealedSubclasses.joinToString("\n") { "  | ${declare(it)}" }
            else -> fields(cls)
        }
        return name
    }

    private fun fields(cls: KClass<*>): String {
        val descriptor = serializer(cls.starProjectedType).descriptor
        val properties = cls.memberProperties.associateBy { it.name }
        val lines = buildList {
            if (cls.supertypes.any { (it.classifier as? KClass<*>)?.isSealed == true }) add("  t: '${descriptor.serialName}'")
            for (i in 0..<descriptor.elementsCount) {
                val field = descriptor.getElementName(i)
                val type = properties.getValue(field).returnType
                add("  $field${if (type.isMarkedNullable) "?" else ""}: ${typeOf(type)}")
            }
        }
        return "export interface ${nameOf(cls)} {\n${lines.joinToString("\n")}\n}"
    }

    private fun typeOf(type: KType): String {
        val cls = type.classifier as KClass<*>
        return when (cls) {
            String::class -> "string"
            Int::class, Long::class, Short::class, Byte::class, Double::class, Float::class -> "number"
            Boolean::class -> "boolean"
            JsonElement::class -> "unknown"
            JsonObject::class -> "Record<string, unknown>"
            List::class, Set::class -> "${typeOf(type.arguments.single().type!!)}[]"
            Map::class -> "Record<string, ${typeOf(type.arguments[1].type!!)}>"
            else -> declare(cls)
        }
    }

    private fun nameOf(cls: KClass<*>): String = cls.java.name.substringAfterLast('.').replace("$", "")

    private companion object {
        const val HEADER = """// Generated from the Kotlin @Serializable protocol types by ProtocolTypesTest. Do not edit.
// Regenerate with: ./gradlew :server:generateProtocol

"""
    }
}
