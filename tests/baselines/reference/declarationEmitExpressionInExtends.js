//// [declarationEmitExpressionInExtends.ts]

var x: {
    new<T>(s: any): Q;
}

class Q {
    s: string;    
}

class B extends x<string> {    
}

var q: B;
q.s;

//// [declarationEmitExpressionInExtends.js]
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var x;
var Q = (function () {
    function Q() {
    }
    return Q;
}());
var B = (function (_super) {
    __extends(B, _super);
    function B() {
        _super.apply(this, arguments);
    }
    return B;
}(x));
var q;
q.s;


//// [declarationEmitExpressionInExtends.d.ts]
declare var x: {
    new <T>(s: any): Q;
};
declare class Q {
    s: string;
}
declare class B extends x<string> {
}
declare var q: B;
