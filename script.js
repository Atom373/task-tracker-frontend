const serverUrl = 'http://localhost:8080/api'

var tasksInfo = {};

$(document).ready(function () {

    var currentDate = new Date();
    var jwtExpirationDate = localStorage.getItem("jwtExpirationDate");
    if (jwtExpirationDate !== null) {
        var expirationDate = new Date(jwtExpirationDate);
        if (expirationDate > currentDate) {
            addJwtToAjaxRequests();
            showGreeting(localStorage.getItem("email"));
            showMain();
        }
    }

    $('#registrationForm').on('submit', function (event) {
        event.preventDefault();
        if (!passwordsAreValid()) {
            return;
        }
        sendRegistartionRequest();
    });

    $("#loginForm").on('submit', function (event) {
        event.preventDefault();
        sendLoginRequest();
    });

    $("#taskAddForm").on("submit", function (event) {
        event.preventDefault();
        var title = $("#taskInput").val().trim();
        $("#taskInput").val("");
        if (title === "")
            return;
        var task = createAndSaveTaskWithTitle(title);
        $("#unfinishedTasksList").prepend(task);
        showOrHideNotifications();
    });
});

function addJwtToAjaxRequests() {
    var jwt = localStorage.getItem("jwt");
    $.ajaxSetup({
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + jwt);
        }
    });
}

function sendRegistartionRequest() {
    var registrationData = {
        'email': $("#email").val(),
        'password' : $("#password").val()
    };
    $.ajax({
        url: serverUrl + '/register', 
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify(registrationData),
        success: function(response) {
            var jwt = response.jwt;
            var jwtExpirationDate = new Date();
            jwtExpirationDate.setDate(new Date().getDate() + 1);
            localStorage.setItem("jwt", jwt);
            localStorage.setItem("jwtExpirationDate", jwtExpirationDate);
            localStorage.setItem("email", registrationData['email']);
            addJwtToAjaxRequests();
            showGreeting(registrationData['email']);
            showMain();
        },
        error: function(xhr, status, error) {
            $("#invalidEmail").html(xhr.responseText).show();
        },
    });    
}

function sendLoginRequest() {
    var loginData = {
        'email': $("#loginEmail").val(),
        'password' : $("#loginPassword").val()
    };
    $.ajax({
        url: serverUrl + '/auth', 
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify(loginData),
        success: function(response) {
            var jwt = response.jwt;
            var jwtExpirationDate = new Date();
            jwtExpirationDate.setDate(new Date().getDate() + 1);
            localStorage.setItem("jwt", jwt);
            localStorage.setItem("jwtExpirationDate", jwtExpirationDate);
            localStorage.setItem("email", loginData['email']);
            addJwtToAjaxRequests();
            showGreeting(loginData['email']);
            showMain();
        },
        error: function(xhr, status, error) {
            $("#invalidEmailOrPassword").show();
        },
    });   
}

function showGreeting(email) {
    var username = email.split('@')[0];
    $("#greeting").html("");
    $("#greeting").append(`Привет, ${username}! Какие задачи у вас есть на сегодня?  `);
    var logoutBtn = $("<button type='button'>Выйти</button>");
    logoutBtn.addClass("btn btn-primary");
    logoutBtn.on("click", processLogout);
    $("#greeting").append(logoutBtn);
}

function processLogout() {
    hideMain();
    localStorage.removeItem("jwt");
}

function getUserTasks() {
    $.ajax({
        url: serverUrl + '/task/all', 
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        success: fillTaskLists,
        error: function(xhr, status, error) {
            console.log("Tasks retrieving request failed");
        },
    }); 
}

function fillTaskLists(allTasks) {
    for (const taskDetails of allTasks) {
       var task = createTask(
           taskDetails.title, 
           taskDetails.description, 
           taskDetails.isFinished,
           taskDetails.id
       );

       if (taskDetails.isFinished) {
           $("#finishedTasksList").prepend(task);
       } else {
           $("#unfinishedTasksList").prepend(task);
       }
       
       tasksInfo[taskDetails.id] = {
            title: taskDetails.title, 
            description: taskDetails.description, 
       }
   }
   showOrHideNotifications();
}

function showOrHideNotifications() {
    if (!$("#unfinishedTasksList").children().length) {
        $("#noUnfinishedTasksNotification").fadeIn();
    } else {
        $("#noUnfinishedTasksNotification").fadeOut();
    }

    if (!$("#finishedTasksList").children().length) {
        $("#noFinishedTasksNotification").fadeIn();
    } else {
        $("#noFinishedTasksNotification").fadeOut();
    }
}

function passwordsAreValid() {
    var password = $('#password').val();
    var confirmPassword = $('#confirmPassword').val();
    // Очистка предыдущих сообщений об ошибках
    $('.invalid-feedback').hide();
    $('#password').removeClass('is-invalid');
    $('#confirmPassword').removeClass('is-invalid');

    if (password.length < 4) {
        $('#password').addClass('is-invalid');
        $('#tooShortPassword').show();
        return false;
    }
    if (password !== confirmPassword) {
        $('#confirmPassword').addClass('is-invalid');
        $('#differentPasswords').show();
        return false;
    }
    return true;
}

function showMain() {
    $("#auth").hide();
    $("#main").removeClass("d-none");
    $("#finishedTasks").removeClass("d-none");
    $("#unfinishedTasks").removeClass("d-none");
    $("#registrationModal").modal("hide");
    $("#loginModal").modal("hide");

    $("#unfinishedTasksList").html("");
    $("#finishedTasksList").html("");
    getUserTasks();

    showOrHideNotifications();
}

function hideMain() {
    $("#auth").show();
    $("#main").addClass("d-none");
    $("#finishedTasks").addClass("d-none");
    $("#unfinishedTasks").addClass("d-none");
}

function createAndSaveTaskWithTitle(title) {
    var task = createTask(title, "", false, null);
    var taskIdHolder = task.find("input[type='hidden']");
    sendCreateTaskRequest(title, taskIdHolder);
    return task;
}

function createTask(title, description, isFinished, taskId) {
    var taskIdHolder = $("<input>").attr("type", "hidden").addClass("d-none");

    if (taskId !== null) {
        taskIdHolder.val(taskId);
    }

    var taskTitleInput = $("<input>").prop("readonly", true).val(title).addClass("form-control-plaintext");

    taskTitleInput.on("blur", function() {
        const taskId = taskIdHolder.val();
        var title = $(this).val().trim();
        if (title !== tasksInfo[taskId].title) {
             sendUpdateTitleRequest(title, taskId);
        }
    });

    var showTaskBodyBtn = $("<button></button>").addClass("btn btn-secondary ms-2 bx bx-chevron-down");

    showTaskBodyBtn.on("click", function(event) {
        var taskHeader = $(this).parent();
        var task = taskHeader.parent();
        if (task.find('textarea').is(":hidden")) {
            $(this).removeClass("bx-chevron-down");
            $(this).addClass("bx-chevron-up");
            task.find('textarea').fadeIn("fast");
            taskHeader.find("input").prop("readonly", false).focus();
        } else {
            $(this).removeClass("bx-chevron-up");
            $(this).addClass("bx-chevron-down");
            task.find('textarea').fadeOut("fast");
            taskHeader.find("input").prop("readonly", true);
        }
    });

    var removeTaskBtn = $("<button></button>").addClass("btn btn-danger ms-3 bx bxs-trash");

    removeTaskBtn.on("click", function() {
        var task = $(this).parent().parent();
        task.fadeOut();
        task.remove();
        sendDeleteTaskRequest(taskIdHolder.val());
        showOrHideNotifications();
    });

    var checkBox = $("<input/>").addClass("form-check-input me-2 border-dark-subtle").attr("type", "checkbox");

    if (isFinished) {
        checkBox.prop('checked', true);
    }

    checkBox.on("click", function() {
        var task = $(this).parent().parent();
        if ($(this).is(":checked")) {
            $("#finishedTasksList").prepend(task);
            sendUpdateIsFinishedRequest(true, taskIdHolder.val());
        } else {
            $("#unfinishedTasksList").prepend(task);
            sendUpdateIsFinishedRequest(false, taskIdHolder.val());
        }
        showOrHideNotifications();
    });

    var taskHeader = $("<div></div>").addClass("d-flex align-items-center h-auto");
    var task = $("<li></li>").addClass("shadow-lg px-3 py-2 mb-3 bg-white rounded mx-3");

    var textarea = $("<textarea></textarea>");
    textarea.attr("rows", 3);
    textarea.attr("placeholder", "Введите описание задачи");
    textarea.val(description);
    textarea.addClass("form-control mt-2");
    textarea.hide();

    textarea.on("blur", function() {
        const taskId = taskIdHolder.val();
        var description = $(this).val().trim();
        if (description !== tasksInfo[taskId].description) {
            sendUpdateDescriptionRequest(description, taskIdHolder.val());
        }
    });
    
    taskHeader.append(checkBox);
    taskHeader.append(taskTitleInput);
    taskHeader.append(showTaskBodyBtn);
    taskHeader.append(removeTaskBtn);

    task.append(taskHeader);
    task.append(textarea);
    task.append(taskIdHolder);

    return task;
} 

function sendCreateTaskRequest(title, taskIdHolder) {
    $.ajax({
        url: serverUrl + '/task', 
        type: 'POST',
        data: {
            title: title
        },
        success: function(taskId) {
            taskIdHolder.val(taskId);
            tasksInfo[taskId] = {
                title: title,
                description: "",
            };
        },
        error: function(xhr, status, error) {
            console.log("Task create request failed");
        },
    }); 
}

function sendUpdateTitleRequest(title, taskId) {
    $.ajax({
        url: serverUrl + '/task/title', 
        type: 'PATCH',
        data: {
            taskId: taskId,
            title: title
        },
        error: function(xhr, status, error) {
            console.log("Title update request failed");
        },
    }); 
    tasksInfo[taskId].title = title;
}

function sendUpdateDescriptionRequest(description, taskId) {
    $.ajax({
        url: serverUrl + '/task/description', 
        type: 'PATCH',
        data: {
            taskId: taskId,
            description: description
        },
        error: function(xhr, status, error) {
            console.log("Description update request failed");
        },
    }); 
    tasksInfo[taskId].description = description;
}

function sendUpdateIsFinishedRequest(isFinished, taskId) {
    $.ajax({
        url: serverUrl + '/task/is-finished', 
        type: 'PATCH',
        data: {
            taskId: taskId,
            isFinished: isFinished
        },
        error: function(xhr, status, error) {
            console.log("Description update request failed");
        },
    });
}

function sendDeleteTaskRequest(taskId) {
    $.ajax({
        url: serverUrl + '/task', 
        type: 'DELETE',
        data: {
            taskId: taskId,
        },
        error: function(xhr, status, error) {
            console.log("Task delete request failed");
        },
    });
    delete tasksInfo[taskId];
}