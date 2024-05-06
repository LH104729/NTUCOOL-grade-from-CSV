function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message == 'get_datas') {
        queries = window.location.search.substr(1).split("&");
        course_id = window.location.pathname.split("/")[2];
        assignment_id = queries[0].split("=")[1];
        student_id = queries[1].split("=")[1];
        sendResponse({ course_id: course_id, assignment_id: assignment_id, student_id: student_id });
    } else if (request.message == 'get_assignment') {
        fetch('https://cool.ntu.edu.tw/api/v1/courses/' + course_id + '/assignments/' + assignment_id).then(response => response.json()).then(data => {
            sendResponse(data);
        });
    } else if (request.message == 'update_rubric_grade'){
        body = request.body;
        fetch('https://cool.ntu.edu.tw/courses/' + course_id + '/gradebook/speed_grader.json?assignment_id=' + assignment_id).then(response => response.json()).then(data => {
            let rubric_id = data.rubric_association.id;
            fetch('https://cool.ntu.edu.tw/courses/' + course_id + '/rubric_associations/' + rubric_id + '/assessments', {
                method: 'POST',
                headers: {
                    "accept":"application/json,text/javascript,application/json+canvas-string-ids,*/*;q=0.01",
                    "accept-language":"zh-TW,zh-HK;q=0.9,zh;q=0.8,en-GB;q=0.7,en-HK;q=0.6,en-US;q=0.5,en;q=0.4",
                    "content-type":"application/x-www-form-urlencoded;charset=UTF-8",
                    "sec-ch-ua":"\"Chromium\";v=\"124\",\"GoogleChrome\";v=\"124\",\"Not-A.Brand\";v=\"99\"",
                    "sec-ch-ua-mobile":"?0",
                    "sec-ch-ua-platform":"\"macOS\"",
                    "sec-fetch-dest":"empty",
                    "sec-fetch-mode":"cors","sec-fetch-site":"same-origin",
                    "x-csrf-token": decodeURIComponent(getCookie('_csrf_token')),
                    "x-requested-with":"XMLHttpRequest"},
                body: body,
                mode: 'cors',
                credentials: 'include'
            }).then(response => {
                sendResponse({status: response.status});
            });
        });
    } else if (request.message == 'update_grade'){
        body = request.body;
        fetch('https://cool.ntu.edu.tw/courses/' + course_id + '/gradebook/update_submission/', {
            method: 'POST',
            headers: {
                "accept":"application/json,text/javascript,application/json+canvas-string-ids,*/*;q=0.01",
                "accept-language":"zh-TW,zh-HK;q=0.9,zh;q=0.8,en-GB;q=0.7,en-HK;q=0.6,en-US;q=0.5,en;q=0.4",
                "content-type":"application/x-www-form-urlencoded;charset=UTF-8",
                "sec-ch-ua":"\"Chromium\";v=\"124\",\"GoogleChrome\";v=\"124\",\"Not-A.Brand\";v=\"99\"",
                "sec-ch-ua-mobile":"?0",
                "sec-ch-ua-platform":"\"macOS\"",
                "sec-fetch-dest":"empty",
                "sec-fetch-mode":"cors","sec-fetch-site":"same-origin",
                "x-csrf-token": decodeURIComponent(getCookie('_csrf_token')),
                "x-requested-with":"XMLHttpRequest"},
            body: body,
            mode: 'cors',
            credentials: 'include'
        }).then(response => {
            sendResponse({status: response.status});
        });
    } else {
        console.log('Unknown message: ' + request.message);
    }
    return true;
});