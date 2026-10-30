<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Masuk | Admin Website</title>
    <!-- Tell the browser to be responsive to screen width -->
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="<?= base_url("assets/plugins/fontawesome-free/css/all.min.css"); ?>">
    <!-- Ionicons -->
    <link rel="stylesheet" href="https://code.ionicframework.com/ionicons/2.0.1/css/ionicons.min.css">
    <!-- icheck bootstrap -->
    <link rel="stylesheet" href="<?= base_url("assets/plugins/icheck-bootstrap/icheck-bootstrap.min.css"); ?>">
    <!-- Theme style -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/admin-lte/3.1.0/css/adminlte.min.css">
    <!-- Google Font: Source Sans Pro -->
    <link href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,400i,700" rel="stylesheet">

    <link rel="stylesheet" href="<?= base_url("assets/css/style.css"); ?>">

    <style>

    </style>

    <script>
        const url = '<?= base_url(); ?>';
    </script>
</head>

<body class="hold-transition login-page latar">
    <div class="login-box">
        <img src="<?= base_url("assets/img/logos/untad.png"); ?>" class="ngambang text-center">
        <div class="login-logo">
            <img src="<?= base_url("assets/img/logos/rs_tangguh.png"); ?>" alt="logo" class="img-fluid">
            <!-- <a href="<?= base_url(); ?>"><b>SPT</b></a> -->
        </div>
        <!-- /.login-logo -->
        <div class="card">
            <div class="card-body login-card-body">
                <?php
                $status_login = $this->session->userdata('status_login');
                if (empty($status_login)) {
                    $message = "Silahkan Login untuk masuk ke literasi";
                } else {
                    $message = $status_login;
                }
                ?>
                <p class="login-box-msg"><?php echo $message; ?></p>
                <div id="responseDiv" class="mt-0 mb-2 p-1" style="display: none;">
                    <!-- <div id="message"></div> -->
                </div>
                <form id="logForm" action="<?= site_url('Baseweb/checklog_admin') ?>" method="POST">
                    <div class="input-group mb-3">
                        <input type="text" class="form-control" name="username" id="username" class="form-control" autocomplete="off" placeholder="Email / Username">
                        <div class="input-group-append">
                            <div class="input-group-text">
                                <span class="fas fa-user"></span>
                            </div>
                        </div>
                    </div>
                    <div class="input-group mb-3">
                        <input type="password" class="form-control" name="password" id="password" placeholder="Password">
                        <div class="input-group-append">
                            <div class="input-group-text">
                                <span class="fas fa-lock"></span>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-6">
                            <button type="submit" class="btn btn-primary" id="logText">Masuk</button>

                        </div>
                        <!-- /.col -->
                        <div class="col-6 text-right">
                            <a href="<?= site_url('Baseweb') ?>" class="btn btn-danger" id="logText">Kembali</a>

                        </div>
                        <!-- /.col -->
                    </div>
                </form>
                <!-- /.social-auth-links -->

                <!-- <p class="mb-1">
                    <a href="forgot-password.html">I forgot my password</a>
                </p> -->
            </div>
            <!-- /.login-card-body -->
        </div>
    </div>
    <!-- /.login-box -->

    <!-- jQuery -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
    <!-- Bootstrap 4 -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/js/bootstrap.bundle.min.js"></script>
    <!-- AdminLTE App -->
    <script src="<?php echo base_url("assets/js/adminlte.js"); ?>"></script>

</body>

</html>