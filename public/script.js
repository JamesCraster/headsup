var socket = io();

$(function () {
    console.log("dimensions: (" + $(window).width() + ", " + $(document).height() + ")");
    socket.on("connect", function() {
        if ($("#nickname-div").css("display") === "block") { //on page refresh hide everything
                $("#nickname-div").css("display", "none");
        }
        if ($("#chat-div").css("display") === "block") { 
            $("#chat-div").css("display", "none");
        }
        if ($("#waiting-div").css("display") === "flex") {
            $("#waiting-div").css("display", "none");
        }
        if ($("#actions-div").css("display") === "block") {
            $("#actions-div").css("display", "none");
        }
        console.log('client created socket');
    });

    socket.on("connection received", function(nickname) {
        console.log("nickname: " + nickname);
        if (nickname) {
            socket.nickname = nickname;
            $("#messages").empty();
            $("#messages").append($("<p class='reconnect' style='font-size: 4vh; float: left;'>").text("Hi " + nickname + "."));
            $("#messages").append("<input class='reconnect' id='reconnect-button' type='button' value='Play' style='margin-left: 0.4vw;'>");
        }
        else {
            $("#nickname-div").css("display", "block");
        }
    });

    socket.on("new hand", function() { //reset everything
        hideButtons();
    });

    socket.on("bet", function(data) {
        if (data.id != socket.id) {
            $("#slider").attr("min", data.min);
            $("#slider").val(data.min);
            $("#slider").attr("max", data.max);
            $("#slider-val").attr("min", data.min);
            $("#slider-val").val(data.min);
            $("#slider-val").attr("max", data.max);
            if (data.amount > 10 || data.stack == 0) { //if not the small blind
                console.log("otherStack: " + data.otherStack);
                if (data.stack == 0 || data.amount >= data.otherStack) { //if an all in, or if bet larger than player's stack, don't allow raise
                    showButtons(3);
                }
                else {
                    $("#bet-button").val("Raise");
                    showButtons(1);
                }
            }
        }
    });

    socket.on("call", function(data) {
        if (data.id == socket.id) {
            $("#slider").attr("min", data.min);
            $("#slider").val(data.min);
            $("#slider").attr("max", data.max);
            $("#slider-val").attr("min", data.min);
            $("#slider-val").val(data.min);
            $("#slider-val").attr("max", data.max);
        }
        else {
            $("#slider").attr("min", data.min);
            $("#slider").val(data.min);
            $("#slider").attr("max", data.otherMax);
            $("#slider-val").attr("min", data.min);
            $("#slider-val").val(data.min);
            $("#slider-val").attr("max", data.otherMax);
            if (data.checkable) {
                $("#bet-button").val("Raise");
                showButtons(2);
            }
        }
        if (!data.checkable) {
            nextRound(data);
        }
    });

    socket.on("check", function(data) {
        if (data.id == socket.id) {
            $("#slider").attr("min", data.min);
            $("#slider").attr("max", data.max);
            $("#slider-val").attr("min", data.min);
            $("#slider-val").attr("max", data.max);
            if (!data.checkable) {
                $("#slider").val(data.min);
                $("#slider-val").val(data.min);
                nextRound(data);
            }
        }
        else {
            $("#slider").attr("min", data.min);
            $("#slider").attr("max", data.otherMax);
            $("#slider-val").attr("min", data.min);
            $("#slider-val").attr("max", data.otherMax);
            if (!data.checkable) {
                $("#slider").val(data.min);
                $("#slider-val").val(data.min);
                nextRound(data);
            }
            else {
                showButtons(2);
            }
        }
    });

    $("#nickname-form").submit(function() {
        var nickname = $("#nickname-box").val();
        if (nickname != "") {
            //socket.nickname = nickname;
            socket.emit("join queue", nickname);
            $("#nickname-error").empty();
            $("#nickname-box").val("");
        }
        return false; //prevent page reloading
    });

    $("body").on("click", "#reconnect-button", function() {
        console.log("reconnect button clicked, nickname: " + socket.nickname);
        $(".reconnect").remove();
        socket.emit("join queue");
    });

    socket.on("queue joined", function(name) {
        if (name) {
            socket.nickname = name;
        }
        $("#nickname-div").css("display", "none");
        $("#waiting-div").css("display", "flex");
    });

    socket.on("nickname error", function(msg) {
        console.log("Error with nickname");
        $("<p style='color:#dc0011; font-size:2vh;'>").text(msg).hide().appendTo("#nickname-error").fadeIn(200);
    });

    $("body").on("click", ".home-button", function() {
        location.reload(); //refresh page
    })

    $("#chat-form").submit(function() {
        if ($("#chat-box").val() != "") {
            socket.emit("message", {message: $("#chat-box").val(), id: socket.id, nickname: socket.nickname});
            console.log('message:' + $("#chat-box").val() + "//");
        $("#chat-box").val("");
        }
        return false;
    });

    $("#slider").on("input", function() {
        $("#slider-val").val($("#slider").val());
    });

    $("#slider-val").change(function() {
        $("#slider").val($("#slider-val").val());
    })

    $(".controls").click(function() {
        hideButtons();
    })

    $("#bet-button").click(function() {
        console.log("bet button clicked");
        socket.emit("bet", {amount: $("#slider").val(), id: socket.id});
    });

    $("#call-button").click(function() {
        console.log("call button clicked");
        socket.emit("call", socket.id);
    });

    $("#check-button").click(function() {
        console.log("check button clicked");
        socket.emit("check", socket.id);
    });

    $("#fold-button").click(function() {
        console.log("fold button clicked");
        socket.emit("fold", socket.id);
    });

    socket.on("game created", function(data) {
        console.log("new game detected");
        $("#waiting-div").css("display", "none");
        $("#chat-div").css("display", "block");
        $("#actions-div").css("display", "block");
        $("#slider-val").text($("#slider").val());
    });

    socket.on("game complete", function(winnerID) { //on game complete
        $("#chat-div").css("display", "none");
        $("#actions-div").css("display", "none");
        var message = (socket.id == winnerID ? "You won." : "You lost.");
        $("#messages").append($("<p class='end-message' style='font-size: 4vh; float: left;'>").text(message));
        $("#messages").append($("<input class='end-message home-button' type='button' value='Home' style='margin-left: 0.4vw; float: left;'>"));
    })

    socket.on("message", function(data) {
        if (!data.error) {
            $("#chat").append($("<li>").text(data.message));
        }
        else {
            $("#chat").append($("<li style='color: #dc0011'>").text(data.message));
        }
        $('#chat-display-div').animate({scrollTop: $('#chat').prop("scrollHeight")}, 500);
    });

    socket.on("result", function(data) { //no need for message filter, append message straight to chat
        window.setTimeout(function() {
            if (data.result == "single winner") {
                $("#chat").append($("<li>").text("Dealer: " + data.nickname + " wins with " + data.bestHand));
            }
            else if (data.result == "split pot") {
                $("#chat").append($("<li>").text("Dealer: " + data.nicknames[0] + " and " + data.nicknames[1] + " split the pot with " + data.bestHand));
            }
        }, 4000);
    });

    socket.on("other player disconnected", function() {
        $("#chat-div").css("display", "none");
        $("#actions-div").css("display", "none");
        var message = ("Your opponent disconnected.");
        $("#messages").append($("<p class='dc-message' style='font-size: 4vh; float: left;'>").text(message));
        $("#messages").append($("<input class='dc-message home-button' type='button' value='Home' style='margin-left: 0.4vw;'>"));
    });
});

function hideButtons() {
    $("#slider").attr("disabled", "disabled");
    $("#slider").css("display", "none");
    $("#slider-val").attr("disabled", "disabled");
    $("#slider-val").css("display", "none");
    $(".controls").attr("disabled", "disabled");
    $(".controls").css("display", "none");
}

function showButtons(action) { //1 for responding to bet, 2 for checkable/opening bet, 3 for call/fold only
    $("#slider").removeAttr("disabled");
    $("#slider").css("display", "block");
    $("#slider-val").removeAttr("disabled");
    $("#slider-val").css("display", "block");
    if (action == 1) {
        $("#bet-button").removeAttr("disabled");
        $("#bet-button").css("display", "block");
        $("#call-button").removeAttr("disabled");
        $("#call-button").css("display", "block");  
        $("#fold-button").removeAttr("disabled");
        $("#fold-button").css("display", "block");
    }
    else if (action == 2) {
        $("#bet-button").removeAttr("disabled");
        $("#bet-button").css("display", "block");
        $("#check-button").removeAttr("disabled");
        $("#check-button").css("display", "block");  
        $("#fold-button").removeAttr("disabled");
        $("#fold-button").css("display", "block");
    }
    else {
        $("#call-button").removeAttr("disabled");
        $("#call-button").css("display", "block");  
        $("#fold-button").removeAttr("disabled");
        $("#fold-button").css("display", "block");
    }
}

function nextRound(data) {
    var toPlay = (data.dealer == socket.id ? false : true); //if not the dealer, then plays first
    window.setTimeout(function() { //display call for 2 seconds and then continue game
        $("#bet-button").val("Bet");
        if (toPlay && data.playingOn) {
            showButtons(2);
        }
    }, 4000);
}
