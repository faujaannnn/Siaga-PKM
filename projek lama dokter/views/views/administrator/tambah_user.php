<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">TAMBAH PENGGUNA</h3>
                        </div>
                        <div class="card-body">
                            <form action="<?= site_url('Administrator/PostTambahAdmin') ?>" method="post">
                                <table class="table table-stripped">
                                    <tr>
                                        <td width="150px">Nama Lengkap</td>
                                        <td><input type="text" name="nama" class="form-control"></td>
                                    </tr>
                                    <tr>
                                        <td>Username</td>
                                        <td>
                                            <input type="text" name="username" class="form-control">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Password</td>
                                        <td>
                                            <input type="text" name="password" class="form-control">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="2">
                                            <button class="btn btn-danger"><i class="fas fa-save"></i> Simpan</button>
                                            <a href="<?= site_url('Administrator/kontrol_panel') ?>" class="btn btn-primary" id="tblback"><i class="fas fa-reply"></i> Kembali</a>
                                        </td>
                                    </tr>
                                </table>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>