window.onload = () => {
    chrome.tabs.query({ active: true, currentWindow: true, url: "https://cool.ntu.edu.tw/courses/*/gradebook/speed_grader?assignment_id=*"}, (tabs) => {
        if (tabs.length == 0) {
            document.getElementById('main').style.display = 'none';
            document.getElementById('status').innerText = 'This extension only works on the speed grader page of NTU COOL.';
        } else {
            document.getElementById('main').style.display = 'block';
            document.getElementById('status').innerText = '';
            initialize();
        }
    });
}

function initialize() {
    document.getElementById('hide_description').addEventListener('change', toggleRubricDescription);
    document.getElementById('update').addEventListener('click', updateData);
    document.getElementById('csv_submit').addEventListener('click', submitCSV);
    updateData();
}

var rubric = [];
var rubric_dict = {};
var course_id = "";
var assignment_id = "";
var student_id = "";

function toggleRubricDescription() {
    if (document.getElementById('hide_description').checked) {
        document.querySelectorAll('.rubric_desc').forEach(function(el) {
            el.style.display = 'none';
        });
    } else {
        document.querySelectorAll('.rubric_desc').forEach(function(el) {
            el.style.display = 'block';
        });
    }
}

function sendMessageAsync(message) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    // console.log(response);
                    resolve(response);
                }
            });
        });
    });
}

function updateData() {
    chrome.tabs.query({ active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {message: 'get_datas'}, (response) => {
            if (!response) {
                return;
            }
            course_id = response.course_id;
            assignment_id = response.assignment_id;
            student_id = response.student_id;
            document.getElementById('course_id').innerText = response.course_id;
            document.getElementById('assignment_id').innerText = response.assignment_id;
            document.getElementById('student_id').innerText = response.student_id;

            chrome.tabs.sendMessage(tabs[0].id, {message: 'get_assignment'}, (response) => {
                if (!response) {
                    return;
                }
                rubric = response.rubric;
                rubric_dict = {};
                rubric_ele = document.getElementById('rubric_div');
                s = '<form action="" id="grade"><table class="border main_table"><tr><th class="border">Title</th><th class="border">Criterion</th><th class="border">Score</th><th class="border">Comment</th></tr>';
                for (let i = 0; i < rubric.length; i++) {
                    s += '<tr class="border"> ';
                    s += '<th class="rubric_title border">' + rubric[i].description + '</th><td class="border"><table class="rubric_item">';
                    for (let j = 0; j < rubric[i].ratings.length; j++) {
                        s += '<tr><td class="rubric_points">' + rubric[i].ratings[j].points + ' Point(s)</td><td class="rubric_desc">' + rubric[i].ratings[j].description + '</td><tr>';
                    }
                    s += '</table></td>';
                    s += '<td class="border center"><input id=' + rubric[i].id + ' class="score_input" type="number"></td>';
                    s += '<td class="borde comment_td"><div class="max_size"><textarea id=' + rubric[i].id + '_comment class="comment_input"></textarea></div></td></tr>';
                    rubric_dict[rubric[i].description] = rubric[i];
                }
                s += '</table><p><button id="submit" type="submit">Submit</button></p></form>';
                rubric_ele.innerHTML = s;
                document.getElementById('grade').addEventListener("submit", event => {
                    event.preventDefault();
                    submit();
                
                });
                toggleRubricDescription();
            });
        });
    });
}

async function submitCSV() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById("status").innerText = "Processing";
    let csv = document.getElementById('input_csv').value;
    let results = Papa.parse(csv, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
    });

    n = results.data.length;
    for (let i = 0; i < n; i++) {
        request_body = [];
        total_score = 0;
        for (const [key, value] of Object.entries(results.data[i])) {
            if (key == "user_id") {
                request_body.push("rubric_assessment[user_id]=" + value);
                request_body.push("rubric_assessment[assessment_type]=grading");
            } else if (key in rubric_dict) {
                if (value === "" || value === null || value === undefined) {
                    continue;
                }
                total_score += parseFloat(value);
                for (let j = 0; j < rubric_dict[key].ratings.length; j++) {
                    if (rubric_dict[key].ratings[j].points == value) {
                        request_body.push("rubric_assessment[criterion_" + rubric_dict[key].id + "][rating_id]=" + rubric_dict[key].ratings[j].id);
                        break;
                    }
                }
                if (key + "_comment" in results.data[i] && results.data[i][key + "_comment"] != "" && results.data[i][key + "_comment"] != null) {
                    request_body.push("rubric_assessment[criterion_" + rubric_dict[key].id + "][comments]=" + escape(results.data[i][key + "_comment"]));
                } else {
                    request_body.push("rubric_assessment[criterion_" + rubric_dict[key].id + "][comments]=");
                }
                request_body.push("rubric_assessment[criterion_" + rubric_dict[key].id + "][points]=" + value);
                request_body.push("rubric_assessment[criterion_" + rubric_dict[key].id + "][save_comment]=0");
            } else if (key.endsWith("_comment")) {
                continue;
            } else {
                console.log("Invalid key: " + key);
                return;
            }
        }
        console.log(request_body);
        request_body.push("graded_anonymously=false")
        request_body.push("_method=POST")
        console.log(request_body.join("&"));
        await sendMessageAsync({message: 'update_rubric_grade', body: request_body.join("&"), course_id: course_id, assignment_id: assignment_id});
        if (!document.getElementById('no_update_score').checked) {
            request_body = ["submission[assignment_id]=" + assignment_id, "submission[user_id]=" + results.data[i]["user_id"], "submission[graded_anonymously]=false", "submission[grade]=" + total_score, "_method=POST"];
            console.log(request_body.join("&"));
            await sendMessageAsync({message: 'update_grade', body: request_body.join("&"), course_id: course_id});
        }
        document.getElementById('status').innerText = "Processed " + (i + 1) + " / " + n;
    }
    document.getElementById('status').innerText = "Submitted " + n + " scores";
}

async function submit() {
    document.getElementById("status").innerText = "Processing";
    window.scrollTo({ top: 0, behavior: 'smooth' });
    request_body = [];
    request_body.push("rubric_assessment[user_id]=" + student_id);
    request_body.push("rubric_assessment[assessment_type]=grading");
    total_score = 0;
    for (let i = 0; i < rubric.length; i++) {
        value = document.getElementById(rubric[i].id).value;
        if (value === "" | value === null || value === undefined) {
            continue;
        }
        total_score += parseFloat(value);
        for (let j = 0; j < rubric[i].ratings.length; j++) {
            if (rubric[i].ratings[j].points == value) {
                request_body.push("rubric_assessment[criterion_" + rubric[i].id + "][rating_id]=" + rubric[i].ratings[j].id);
                break;
            }
        }
        request_body.push("rubric_assessment[criterion_" + rubric[i].id + "][points]=" + value);
        request_body.push("rubric_assessment[criterion_" + rubric[i].id + "][comments]=");
        request_body.push("rubric_assessment[criterion_" + rubric[i].id + "][save_comment]=0");
    }
    request_body.push("graded_anonymously=false")
    request_body.push("_method=POST")
    console.log(request_body);
    if (request_body.length == 4) {
        console.log("No data to submit");
        return;
    }
    await sendMessageAsync({message: 'update_rubric_grade', body: request_body.join("&")}).then(response => {
        if (response.status == 200) {
            document.getElementById("status").innerText = "Submitted score for student " + student_id;
        } else {
            document.getElementById("status").innerText = "Failed to submit score for student " + student_id;
        }
    });
    if (!document.getElementById('no_update_score').checked) {
        request_body = ["submission[assignment_id]=" + assignment_id, "submission[user_id]=" + results.data[i]["user_id"], "submission[graded_anonymously]=false", "submission[grade]=" + total_score, "_method=POST"];
        console.log(request_body.join("&"));
        await sendMessageAsync({message: 'update_grade', body: request_body.join("&"), course_id: course_id});
    }
    return true;
}