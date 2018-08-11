import { Player } from "./player";
import { eventEmitter as emitter} from "../index";
var pokerEval = require('poker-evaluator');

export class Game {
	private _players : Array<Player> = [];
	private _id : string;
	private _deck : Array<number> = []; //generated by constructor
	private _table : Array<number> = []
	private _io;
	private _gameStage : number = 1; //flop, turn, river = 1, 2, 3
	private _pot : number;
	private _dealer : number = 0;

	public constructor(p1 : Player, p2 : Player, id : string, io) {
		p1.inGame = true;
		p2.inGame = true;
		this.addPlayer(p1);
		this.addPlayer(p2);
		this._io = io;
		this._id = id;
		p1.socket.join(id); //join the game's chat room
		p2.socket.join(id);
		//console.log('room size: ' + io.sockets.adapter.rooms[id].length);
		if (io.sockets.adapter.rooms[id].length == 2) { //seems to work without a loop
			io.to(id).emit('game created', [this._players[0].nickname, this._players[1].nickname]);	
		}
		console.log("new game created with id " + id + " and players " + p1.id + ", " + p2.id);
		this.play();
	}

	public addPlayer(player : Player) {
		this._players.push(player);
	}

	get id() {
		return this._id;
	}

	public containsPlayer(id : string) : boolean {
		console.log('Length of players in game ' + this._players.length);
		for (var i=0; i<this._players.length ;i++) {
			if (this._players[i].id === id) {
				console.log('containsPlayer returning true')
				return true;
			}

			else {
				console.log('search ID ' + id + ' does not match current ID ' + this._players[i].id);
			}
		}
		return false;
	}

	public stringifyHand(hand : Array<number>) : Array<string> {
		var stringHand = [];
		for (var i=0; i<hand.length; i++) {
			var card = "";
			var cardNumber = hand[i] % 13;
			var cardSuit = Math.floor(hand[i] / 13);

			if (cardNumber < 10 && cardNumber > 1) {
				card += cardNumber;
			}
			else if (cardNumber == 10) {
				card += "T";
			}
			else if (cardNumber == 11) {
				card += "J";
			}
			else if (cardNumber == 12) {
				card += "Q";
			}
			else if (cardNumber == 0) {
				card += "K";
			}
			else {
				card += "A";
			}

			if (cardSuit == 0) {
				card += "s";
			}
			else if (cardSuit == 1) {
				card += "d";				
			}
			else if (cardSuit == 2) {
				card += "c";
			}
			else {
				card += "h";
			}
			stringHand.push(card);
		}
		return stringHand;
	}

	public compareHands(p1Hand : Array<string>, p2Hand : Array<string>) : number {
		var p1Eval = pokerEval.evalHand(p1Hand);
		var p2Eval = pokerEval.evalHand(p2Hand);

		if (p1Eval.handType > p2Eval.handType) {
			return 1;
		}
		else if (p2Eval.handType > p1Eval.handType) {
			return 2;
		}
		else { //if the same hand type
			if (p1Eval.handRank > p2Eval.handRank) {
				return 1;
			}
			else if (p2Eval.handRank > p1Eval.handRank) {
				return 2;
			}
			else {
				return 3; //split pot
			}
		}
	}

	public newHand() {
		console.log('starting new hand');
		this._io.to(this.id).emit('new hand');
		this._deck = []; //initialise deck
		for (var i=0; i<52; i++) {
			this._deck.push(i);
		}
		this._dealer = (this._dealer + 1) % 2; //change dealer
		this._table = []; //clear table
		for (var i=0; i<this._players.length; i++) {
			this._players[i].bet = 0;
		}
		this._gameStage = 1;
		this._pot = 0;
		this.deal(); //deal new hole cards to players

		this.handleBet(10, this._players[this._dealer].id); //set blinds
		this.handleBet(20, this._players[(this._dealer + 1) % 2].id);
	}

	public getRandomCard() : number {
		var i = Math.floor(Math.random() * 52);
		return this._deck.splice(i, 1)[0];
	}

	public deal() {
		for (var i=0; i<this._players.length; i++) {
			var cards = [this.getRandomCard(), this.getRandomCard()];
			this._players[i].holeCards = cards;
			this._io.to(this._players[i].id).emit('hole cards', this.stringifyHand(cards));
		}
	}

	public handleBet(amount : number, id : string) {
		amount = Number(amount); //convert amount to number
		for (var i=0; i<this._players.length; i++) {
			if (id == this._players[i].id) {
				this._players[i].bet = amount;
				var otherBet  = this._players[(i+1)%2].bet;
				var otherStack = this._players[(i+1)%2].stack;
				var min = (amount != 20 ? 2 * amount - otherBet : 40); //min raise is 40 for the small blind
				this._io.to(this.id).emit('bet', {amount: amount, min: min, max: otherStack, pot: this._pot,  id: id});
			}
		}
	}

	public handleCall(id : string) { //even out bet amounts. To do: ensure a call by the small blind doesn't lead straight to flop
		if (this._players[0].bet > this._players[1].bet) {
			var a = this._players[0];
			var b = this._players[1];
		}
		else {
			var a = this._players[1];
			var b = this._players[0];
		}
		var allIn = false;
		if (a.bet >= b.stack) { //excess allocated to a
			b.bet = b.stack;
			var excess = a.stack - b.bet;
			var excessWinner  = a ;
			allIn = true;
		}
		else if (a.bet == a.stack) { //b stack > a stack. Excess allocated to b
			if (b.stack > a.stack) {
				b.bet = a.bet;
				var excess = b.stack - b.bet;
				var excessWinner = b;
			}
			allIn = true;
		}

		else {
			b.bet = a.bet;
		}
		for (var i=0; i<this._players.length; i++) { //decrease stacks
			this._players[i].changeStack(this._players[i].bet * -1);
		}
		for (var i=0; i<this._players.length; i++) {
			if (id == this._players[i].id) {
				var otherStack = this._players[(i+1)%2].stack;
				var calledStack = this._players[i].stack;
			}
		}

		console.log("Game stage: " + this._gameStage);
		if (this._gameStage == 1 && a.bet == 20) {
			this._io.to(this.id).emit('call', {amount: a.bet, pot: this._pot, min: 40, max: calledStack, otherMax: otherStack, id: id, dealer: this._players[this._dealer].id, checkable: true});
		}
		else {
			var cardsToDeal = !allIn ? this.getCardsToDeal() : this.getCardsAllIn();

			this._gameStage += 1;
			this._pot += this._players[0].bet + this._players[1].bet;
			this._table = this._table.concat(cardsToDeal);
			this._io.to(this.id).emit('call', {amount: a.bet, pot: this._pot, cards: this.stringifyHand(cardsToDeal), min: 20, max: calledStack, otherMax: otherStack, id: id, dealer: this._players[this._dealer].id, checkable: false, playingOn : (this._gameStage != 5 && !allIn)}); //amount the same for both players so whose bet does not matter
			this._players[0].bet = 0; //reset bets
			this._players[1].bet = 0;

			if (this._gameStage == 5 || allIn) {
				var p1Hand = this.stringifyHand(this._players[0].holeCards.concat(this._table));
				var p2Hand = this.stringifyHand(this._players[1].holeCards.concat(this._table));
				if (allIn) {
					this.interpretResult(this.compareHands(p1Hand, p2Hand), excess, excessWinner);
				}
				else {
					this.interpretResult(this.compareHands(p1Hand, p2Hand), 0, a); //filler values 0 and a used
				}
				//show both players' hands
			}
		}
	}

	public interpretResult(result : number, excess? : number, excessWinner? : Player) { //send result and begin new hand
		if (result < 3) {
			var i = result - 1;
			this._players[i].changeStack(this._pot - excess);
			excessWinner.changeStack(excess);
			this._io.to(this.id).emit('result', {result: 'single winner', id: this._players[i].id});
		}
		else {
			for (var i=0; i<this._players.length; i++) {
				this._players[i].changeStack((this._pot - excess)/ 2); //award half the pot to each player
			}
			excessWinner.changeStack(excess);
			this._io.to(this.id).emit('result', {result: 'split pot'});
		}
		setTimeout(()=> {console.log(this.id); emitter.emit('hand complete' + this.id)}, 6000); //wait 4 seconds before starting new hand
	}

	public handleCheck(id : string) {
		if (id == this._players[this._dealer].id || this._gameStage == 1) { //if the dealer checked or the non-dealer checked after big blind called
			for (var i=0; i<this._players.length; i++) {
				if (id == this._players[i].id) {
					var otherStack = this._players[(i+1)%2].stack;
					var checkedStack = this._players[i].stack;
				}
		}
			var cardsToDeal = this.getCardsToDeal();

			this._gameStage += 1;
			this._pot += this._players[0].bet + this._players[1].bet;
			this._table = this._table.concat(cardsToDeal);
			this._io.to(this.id).emit('check', {id: id, checkable: false, pot: this._pot, cards: this.stringifyHand(cardsToDeal), dealer: this._players[this._dealer].id, min: 20, max: checkedStack, otherMax: otherStack, playingOn: true});
			this._players[0].bet = 0; //reset bets
			this._players[1].bet = 0;

			if (this._gameStage == 5) {
				var p1Hand = this.stringifyHand(this._players[0].holeCards.concat(this._table));
				var p2Hand = this.stringifyHand(this._players[1].holeCards.concat(this._table));
				this.interpretResult(this.compareHands(p1Hand, p2Hand));
				//show both players' hands
			}
		}
		else {
			this._io.to(this.id).emit('check', {id: id, checkable: true});
		}
	}

	public handleFold(id: string) {
		for (var i=0; i<this._players.length; i++) {
			if (this._players[i].id != id) {
				this._players[i].changeStack(this._pot);
			}
		}
		this._io.to(this.id).emit('fold', {pot: this._pot, id: id});
		setTimeout(()=> {emitter.emit('hand complete' + this.id)}, 3000);
	}

	public play() { //add event to emit cards, add max and min bets for slider, evaluate hand, play entire game
		this.newHand();
		emitter.on('call' + this.id, (id)=>{ //using the => syntax so that 'this' refers to the game rather than index
			console.log('game received call');
			this.handleCall(id);
		});

		emitter.on('fold' + this.id, (id)=>{
			console.log('game received fold');
			this.handleFold(id);
		});

		emitter.on('check' + this.id, (id)=>{
			console.log('game received check');
			this.handleCheck(id);
		});

		emitter.on('bet' + this.id, (data)=>{
			console.log('game received bet');
			this.handleBet(data.amount, data.id);
		});

		emitter.on('hand complete' + this.id, ()=>{
			console.log('game received hand complete')
			if (this._players[0].stack != 0 && this._players[1].stack != 0) {
				this.newHand();
			}
			else {
				var winnerID = (this._players[0].stack == 0 ? this._players[1].id : this._players[0].id);
				this._io.to(this.id).emit("game complete", winnerID);
			}
		});
	}

	public getCardsToDeal() : number[] {
		var cardsToDeal = [];
		if (this._gameStage < 4) {
			if (this._gameStage > 1) { //turn or river
				cardsToDeal.push(this.getRandomCard());
			}
			else {
				for (var i=0; i<3; i++) { //flop
					cardsToDeal.push(this.getRandomCard());
				}
			}
		}
		return cardsToDeal;
	}

	public getCardsAllIn() : number[] {
		var cardsToDeal = [];
		if (this._gameStage == 1) {
			for (var i=0; i<5; i++) {
				cardsToDeal.push(this.getRandomCard());
			}
		}
		else {
			for (var i=0; i<4-this._gameStage; i++) {
				cardsToDeal.push(this.getRandomCard());
			}

		}
		return cardsToDeal;
	}
}