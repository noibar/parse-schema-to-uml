import fs from 'fs'
import axios from 'axios'
import { program } from 'commander'

const POINTER_CLASS = 'Pointer'

async function fetchSchema(parseServerUrl, appId, masterKey) {
    const requestConfig = {
        headers: {
            'X-Parse-Application-Id': appId, 'X-Parse-Master-Key': masterKey
        }
    }

    const res = await axios.get(parseServerUrl, requestConfig)
    if (!res.data || !res.data.results) {
        console.error('response format is unexpected. Expected to have results field.')
        return
    }

    return res.data.results
}

async function schemaToUml(schema) {
    let desc = []
    let classes = []
    let relations = []
    const classCloser = '}'
    for (const index in schema) {
        let cls = schema[index]
        const classHeader = `class ${cls['className']} {`
        classes.push(classHeader)
        for (const key in cls.fields) {
            let fieldType = cls.fields[key].type
            if (fieldType === POINTER_CLASS) {
                fieldType = cls.fields[key].targetClass // Rewrite pointer fieldType to use the original class.
                relations.push(`${cls['className']} <|-- ${fieldType}`)
            }
            classes.push(`\t${fieldType} ${key}`)
        }
        classes.push(classCloser)
    }

    desc = desc.concat(relations)
    desc = desc.concat(classes)
    const content = desc.join('\n')

    const plantUml = `
		  @startuml
		  ${content}
		  @enduml`

    return plantUml
}

function writeToFile({content, path}) {
    try {
        fs.writeFile(path, content, (err) => {
            if (err) {
                log.error('[file] writeFile error', {err})
            }
        })
    } catch (ex) {
        console.error('[file] writeFile exception', {ex})
    }
}

program
    .option('-a, --app-id [appId]', 'parse app id')
    .option('-m, --master-key [masterKey]', 'master key')
    .option('-s, --server-url [serverUrl]', 'parse server url')
    .option('-i, --in-file [inFile]', 'schema input file')
    .option('-o, --out-file [outFile]', 'schema output file', 'plantuml.txt')
    .parse(process.argv)

if (!program.inFile && !(program.appId && program.masterKey && program.serverUrl)) {
   console.log('Please specify a file to read the schema from, or parse server details.\n' +
       program.helpInformation())
   process.exit()
}

let readSchemaPromise
if (program.inFile) {
    if (!fs.promises) {
        console.error('Please use node >=v10.0.0')
        process.exit()
    }
    readSchemaPromise = fs.promises.readFile(program.inFile)
} else {
    readSchemaPromise = fetchSchema(program.serverUrl, program.appId, program.masterKey)
}
readSchemaPromise.then(schema => {
    console.log(`read schema successfully, converting to uml`)
    schemaToUml(schema).then(uml => {
        console.log(`created uml successfully, writing to ${program.outFile}`)
        writeToFile({content: uml, path: program.outFile})
        process.exit()
    })
})
