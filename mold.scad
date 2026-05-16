include <SnapLib.0.36.scad>

// triangle face coordinates
p1=[0,0];
p2=[15,0];
p3=[10,10];
$fn=30;
border =1;
gw=0.4;
gs=4;
max=30;
module tri (a,b,c)  polygon([a,b,c]);
rh=10;
thick=1.6;
angle=25;
d=10;
module male(rm) {
translate([0,0,-thick])linear_extrude(thick) polygon( [[-rm/tan(angle/2),-rm],for(a=[90+angle:-2*angle/20:90-angle]) [rm*cos(a),rm*sin(a)],[rm/tan(angle/2),-rm]]);
rotate([0,0,-45])RSnapY(3.4*thick,3,30,2,rm*0.6,f=1.5,K2=2);
}

module female(rm) {
  difference() {
    union() {
      linear_extrude(thick) polygon( [[-rm/sin(angle/2),-rm],for(a=[180-angle:-3:angle]) [rm*cos(a),rm*sin(a)],[rm/sin(angle/2),-rm]]);
      translate([0,0,thick]) cylinder(r1=rm,r2=rm*0.7,h=2*thick);
    }
    cylinder(r=rm*0.6,h=4*thick);
  }
}
module male1(alpha,h,w,depth,eps=0.1) {
difference() {
    union() {
        translate([0,h/2,0]) SnapH(depth,1.5,30,h,f=1);
        mirror([0,1,0]) translate([0,h/2,0]) SnapH(depth,1.5,30,h,f=1);
    }
    rotate([0,alpha,0]) translate([-5,-h/2-eps,0]) cube([5,h+2*eps,2*h]);
}
}

module female1() {
    translate([0,-3,0])cube([10,6,7]);
}

module Malemold(h,w) {
translate([0,-25,0])cube([10,50,thick]);
rotate([0,-angle,0])translate([0,-25,0])cube([thick,50,12]);
mirror([1,0,0]) male1(angle,h,w,d);
}
mirror([1,0,0]) color("green")rotate([0,2*angle,0])Malemold(7,6);
module Femalemold(h,w) {
difference() {
    union() {
        translate([0,-25,0])cube([10,50,thick]);
        rotate([0,-angle,0])translate([0,-25,0])cube([thick,50,12]);
        translate([0,2+h/2,0])rotate([90,0,0])linear_extrude(h+4) polygon([[0,0],[d*cos(2*angle),0],[d*cos(2*angle),d*sin(2*angle)],[d*cos(2*angle)-(w+2)*sin(2*angle),d*sin(2*angle)+(w+2)*cos(2*angle)],[-d*sin(angle),d*cos(angle)]]);
        //rotate([0,-2*angle,0])cube([20,10,10]);
        }
        translate([0,-h/2,0]) rotate([0,-2*angle,0])cube([20,h,w]);
        }
        }
  Femalemold(7,6);      
//translate ([0,3*rh,0]) rotate([90,0,0]) male(rh);
//rotate([90,0,0])female(rh);
/*
difference() {
    tri(p1,p2,p3);
    offset(-border) tri(p1,p2,p3);
    }

intersection() {
    tri(p1,p2,p3); 
    union() {
        for(i=[-max:gs:max]) {
            polygon([[-max,i],[max,i],[max,i+gw],[-max,i+gw]]);
            polygon([[i,-max],[i,max],[i+gw,max],[i+gw,-max]]);
        }
    }
}
*/
        