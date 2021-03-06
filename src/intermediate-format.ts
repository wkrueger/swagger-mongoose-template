type Reference = { __reference__: string }
const Reference = str => ({ __reference__: str })

type TypesEnum = 'String' | 'Number' | 'Boolean' | 'Date'
type Type = { __type__: TypesEnum, enum?: any[] }
const Type = (str: TypesEnum, en?) => ({ __type__: str, enum: en })

type Arr = { __array__: Type | Reference }
const Arr = (any) => ({ __array__: any })

export type IntermediateType = { required?: boolean; __extends__?: string[] } & (Type | Reference | Arr)

type SwaggerType = {
    type: string
    description?: string
    maxLength?: number
    $ref?: string
    format?: string
    enum?: (string | number)[]
    properties?: { [name: string]: SwaggerType }
    items?: any
    allOf?: SwaggerType[]
    anyOf?: SwaggerType[]
    required?: string[]
}
//-----


export function convert(__doc) {
    const $definitionRoot = 'definitions'

    if (!Object.keys(__doc[$definitionRoot] || {}).length) {
        throw Error('No definition found in ' + $definitionRoot)
    }
    let out = pairs(__doc[$definitionRoot]).reduce((out, [key, val]) => {
        out[key] = typeTemplate(val)
        return out
    }, {})


    return out
}

export function typeTemplate(swaggerType: SwaggerType): IntermediateType {

    if (swaggerType.$ref) {
        let split = swaggerType.$ref.split('/')
        return Reference(split[split.length - 1])
    }

    if (swaggerType.enum) {
        return Type('String', swaggerType.enum)
    }

    if (~['integer', 'double', 'number'].indexOf(swaggerType.type)) {
        return Type('Number')
    }

    if (swaggerType.type === 'boolean') {
        return Type('Boolean')
    }

    if (swaggerType.type === 'string' ) {
        if (swaggerType.format === 'date' || swaggerType.format === 'date-time')
            return Type('Date')
        return Type('String')
    }


    if (swaggerType.type === 'object' || swaggerType.properties) {
        let merged = pairs(swaggerType.properties).reduce((out, [key, prop]) => {
            let required = (swaggerType.required && swaggerType.required.indexOf(key) != -1)
            let inner = typeTemplate(prop)
            out[key] = inner
            if (required) out[key].required = true
            return out
        }, {} as any)
        return merged
    }

    if (swaggerType.type === 'array') {
        let inner = typeTemplate(swaggerType.items)
        return Arr(inner)
    }

    if (swaggerType.allOf) {
        let merged = mergeAllof(swaggerType)
        let data = typeTemplate(merged.swaggerDoc)
        data.__extends__ = merged.extends
        return data
    }

    if (swaggerType.anyOf) {
        let merged = mergeAllof(swaggerType, 'anyOf')
        let data = typeTemplate(merged.swaggerDoc)
        data.__extends__ = merged.extends
        return data
    }

    if (swaggerType.type === 'file') {
        return Type('String')
    }

    throw swaggerType.type

}


function mergeAllof(swaggerType: SwaggerType, key: 'allOf' | 'anyOf' = 'allOf') {
    let item = swaggerType[key]
    if (!item) throw Error('wrong mergeAllOf call.')
    var extend = [] as any[];
    let merged = item.reduce((prev, toMerge) => {
        let refd: SwaggerType

        if (toMerge.$ref) {
            let split = toMerge.$ref.split('/')
            if (split[0] === '#' && split[1] === 'definitions' && split.length === 3) {
                extend.push(split[2])
                return prev
            }
            refd = toMerge
            //refd = findDef(__doc, split)
        }
        else {
            refd = toMerge
        }
        if (refd.allOf) refd = mergeAllof(refd, 'allOf').swaggerDoc
        else if (refd.anyOf) refd = mergeAllof(refd, 'anyOf').swaggerDoc
        if (!refd.properties) {
            console.error('allOf merge: unsupported object type at ' + JSON.stringify(toMerge))
        }
        for (var it in <any>refd.properties) {
            //if ((<any>prev).properties[it]) console.error('property', it, 'overwritten in ', JSON.stringify(toMerge).substr(0,80));
            ; (<any>prev).properties[it] = (<any>refd).properties[it]
        }
        return prev
    }, { type: 'object', properties: {} })
    return { swaggerDoc: merged, extends: extend }
}


function pairs(obj = {}) {
    return Object.keys(obj).map( key => [key, obj[key]] )
}