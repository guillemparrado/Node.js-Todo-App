const os = require('os')
const { execSync } = require('child_process')

/*
FONTS
- https://www.mysqltutorial.org/mysql-nodejs/
- https://riptutorial.com/javascript/example/10543/functions-with-an-unknown-number-of-arguments--variadic-functions-

ES6 Variadic + spread operator:
- a(1,2,3)
- function a(...asd){console.log(asd)} -> log rep un sol objecte i l'imprimeix: l'array d'arguments: [1,2,3]
- function a(...asd){console.log(...asd)} -> log rep 3 objectes i els imprimeix: 1,2,3

Mecanisme:
- A signatura de funció, ...asd agafa tots els arguments separats per coma, els posa dins de l'array 'asd' i el fa disponible al cos de la funció.
- A code block fa el procés invers, agafa un array i el converteix a els seus elements separats per comes per no haver-los d'enumerar estàticament.
 */

const {sqlSelect, sqlSingleSelect, sqlInsert, sqlUpdate, sqlDelete} = require('./utils/MySQL_queries');

async function connect(){
    console.log(`Executant scripts de creació d'usuari i schema a mysql en cas que no existeixin...`);
    console.log(`User: root`);
    const mysqlPath = os.platform() === 'darwin' ? '/usr/local/mysql/bin/mysql' : 'mysql'
    execSync(`${mysqlPath} -u root -p < ./mysql_scripts/all.sql`)
}

async function getTask(id) {
    if (id) {
        let result = await sqlSingleSelect(
            "*",
            "task t JOIN user u ON t.author_id = u.id",
            "t.id = ?",
            [id]
        )
        // Hi ha un bug a 'mysql' package: la id d'objecte retornat fent join no és la de task sinó la de user (???), reassigno la de task.
        // Debug: només reassigno en cas que hagi trobat la tasca (sinó, TypeError: Cannot set property 'id' of undefined)
        if(result != undefined){
            result.id = id;
        }
        return result;
    }
    else
        // Podem estalviar la consulta si s'ha cridat sense id
        throw new Error("getTask hasn't been given an id");
}

/**
 * Busca user by name i retorna id si existeix. En cas que no existeixi, el crea i en retorna l'id.
 * @param name
 * @returns {Promise<*>}
 */
async function getUserId(name) {
    // Si s'ha rebut un nom
    if(name){
        // Troba id d'usuari si existeix
        let user_id;
        const user = sqlSingleSelect(
            "id",
            "user",
            "name = ?",
            [name]
        )
        if(user)
            user_id = user.id;

        // Si no exiteix, crea'l
        if(!user_id)
            user_id = (await sqlInsert(
                "user(id, name)",
                "(?, ?)",
                [null, name]
            )).insertId; // Inserted id retornada

        return user_id;
    }
    // Podem estalviar la consulta si s'ha cridat sense user_name
    else
        throw new Error("getTask hasn't been given an id");
}

async function getAllTasks() {
    return await sqlSelect(
        "*",
        "task t JOIN user u ON t.author_id = u.id"
    );
}

async function saveNewTask(task) {
    // Inicialitza els valors per defecte que calgui
    if(task.state == null)
        task.state = 'pending';
    if(task.start_time == null)
        task.start_time = new Date();

    // Afegeix FK d'author a task (el crea si no existeix)
    task.author_id = await getUserId(task.author);

    // Crea task
    task.id = (await sqlInsert(
        "task(id, description, state, start_time, end_time, author_id)",
        "(null, ?, ?, ?, ?, ?)",
        [task.description, task.state, task.start_time, task.end_time, task.author_id]
    )).insertId; // Guarda la id autogenerada a l'insert
}

async function updateTask(id, task) {
    // task.author pot haver canviat. Actualitza la id associada al nom (crea nou user en cas que no existeixi)
    task.author_id = await getUserId(task.author);

    // Update task
    await sqlUpdate(
        `task`,
        `description=?,state=?,start_time=?,end_time=?,author_id=?`,
        `id=?`,
        [task.description, task.state, task.start_time, task.end_time, task.author_id, task.id]
    )
}

async function deleteTask(object) {
    // Se li pot passar l'objecte a eliminar o directament la _id
    let id;

    // Cas: se li passa directament una _id
    if (typeof object === 'string') {
        id = object;
    }
    // Cas: se li passa un objecte a eliminar
    else if ('id' in object) {
        id = object.id;
    }

    // Si input vàlid, elimina
    if (id) {
        await sqlDelete(
            "task",
            "id=?",
            [id]
        )
    }
}

async function deleteAll() {
    await sqlDelete("task");
    await sqlDelete("user");
}

module.exports = { connect, getTask, getAllTasks, saveNewTask, updateTask, deleteTask, deleteAll }
